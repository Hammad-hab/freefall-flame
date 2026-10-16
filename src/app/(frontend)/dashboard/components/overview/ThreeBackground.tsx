"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const FPS = 10;
const SPEED = 0.2;
const interval = 1000 / FPS;

/**
 * Full-screen Three.js canvas fixed in the background of the overview tab.
 *
 * Renders a full-screen plane with a ShaderMaterial running a Shadertoy-derived
 * raymarching shader ("Promethean" by nimitz). The expensive shader runs at a
 * low FPS into render targets; a cheap temporal-blend blit runs every frame
 * to produce smooth output at display refresh rate.
 */
export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    renderer.autoClear = false;
    renderer.setPixelRatio(1);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // --- Orthographic camera + full-screen plane ---
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2);

    // --- Noise texture for iChannel0 ---
    const noiseSize = 256;
    const noiseData = new Uint8Array(noiseSize * noiseSize * 4);
    for (let i = 0; i < noiseData.length; i += 4) {
      noiseData[i] = Math.random() * 255;
      noiseData[i + 1] = Math.random() * 255;
      noiseData[i + 2] = Math.random() * 255;
      noiseData[i + 3] = 255;
    }
    const noiseTexture = new THREE.DataTexture(
      noiseData,
      noiseSize,
      noiseSize,
      THREE.RGBAFormat,
    );
    noiseTexture.needsUpdate = true;
    noiseTexture.wrapS = THREE.RepeatWrapping;
    noiseTexture.wrapT = THREE.RepeatWrapping;
    noiseTexture.minFilter = THREE.LinearFilter;
    noiseTexture.magFilter = THREE.LinearFilter;

    // --- ShaderMaterial ---
    const material = new THREE.ShaderMaterial({
      uniforms: {
        iTime: { value: 0 },
        iResolution: {
          value: new THREE.Vector3(mount.clientWidth, mount.clientHeight, 1),
        },
        iMouse: { value: new THREE.Vector4(0, 0, 0, 0) },
        iChannel0: { value: noiseTexture },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
      // Promethean by nimitz (twitter: @stormoid)
      // https://www.shadertoy.com/view/4tB3zV
      // License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License
      // Contact the author for other licensing options

      //More "Spark-ish" look
      //#define SPARKS

      #ifdef SPARKS
      #define PALETTE vec3(0.0,.2,1.5)
      #else
      #define PALETTE vec3(1.2,0.,.0)
      #endif

      #define HIGH_QUALITY

      #ifdef HIGH_QUALITY
      #define STEPS 80
      #define ALPHA_WEIGHT 0.022
      #define BASE_STEP 0.05
      #else
      #define STEPS 45
      #define ALPHA_WEIGHT 0.044
      #define BASE_STEP 0.11
      #endif

      uniform float iTime;
      uniform vec3 iResolution;
      uniform vec4 iMouse;
      uniform sampler2D iChannel0;
      varying vec2 vUv;

      vec2 mo;
      vec2 rot(in vec2 p, in float a){float c = cos(a), s= sin(a);return p*mat2(c,s,-s,c);}
      float hash21(in vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
      float noise(in vec3 p)
      {
          vec3 ip = floor(p), fp = fract(p);
          fp = fp*fp*(3.0 - 2.0*fp); //Cubic smoothing
          vec2 tap = (ip.xy+vec2(37.0,17.0)*ip.z) + fp.xy;
          vec2 rz = textureLod( iChannel0, (tap + 0.5)/256.0, 0.0 ).yx;
          return mix(rz.x, rz.y, fp.z);
      }

      float fbm(in vec3 p)
      {
          p *= 2.5 + mo.y*2.;
          float rz = 0., z = 1.;
          for(int i=0;i<4;i++)
          {
              float n = noise(p + iTime*.5);
              rz += (sin(n*4.3)*1.-.45)*z;
              z *= .47;
              p *= 3.;
          }
          return rz;
      }

      float dsph(in vec3 p)
      {
          float r = dot(p,p);
          vec2 sph = vec2(acos(p.y/r), atan(p.x, p.z));
          r += sin(sph.y*2.+sin(sph.x*2.)*5.)*0.8;
          return r;
      }

      vec4 map(in vec3 p)
      {
          float r2 = dot(p,p);
          if (r2 > 5.6) return vec4(0.);

          float dtp = dsph(p);
          if (dtp > 4.75) return vec4(0.);

          p = .7*p/(dtp + .1);
          p.xz = rot(p.xz, p.y*2.);
          p = 6.*p/(dtp - 5.4);
          p = 7.*p/(dtp + 6.);
          float r = clamp(fbm(p)*1.5-exp2(dtp*0.7-2.75), 0., 1.);
          if (r <= 0.) return vec4(0.);

          vec4 col = vec4(1.)*r;
          vec3 lv = mix(p,vec3(.25),1.25);
          float grd = clamp((col.w - fbm(p+lv*.045))*4.5, 0.01, 2.);
          col.rgb *= grd*vec3(.9, 1., .43) + vec3(.05,0.1,0.0);
          col.a *= clamp(dtp*0.5-.14,0.,1.)*0.7 + 0.3;
          return col;
      }

      vec4 vmarch(in vec3 ro, in vec3 rd)
      {
          vec4 rz = vec4(0);
          float b = dot(ro, rd);
          float h = b*b - (dot(ro,ro) - 5.6);
          if (h < 0.) return vec4(0.);
          h = sqrt(h);
          float t    = max(2.4, -b - h);
          float tEnd = min(6.,  -b + h);
          t += 0.03*hash21(gl_FragCoord.xy);
          for (int i = 0; i < STEPS; i++)
          {
              if (rz.a > 0.99 || t > tEnd) break;

              vec3 pos = ro + t*rd;
              vec4 col = map(pos);
              float den = col.a;
              col.a *= ALPHA_WEIGHT;
              col.rgb *= col.a*1.4;
              rz = rz + col*(1. - rz.a);
              t += BASE_STEP-den*BASE_STEP;
          }
          rz.rgb += PALETTE*rz.w;
          return rz;
      }

      vec4 mainImage(in vec2 fragCoord)
      {
          vec2 p = fragCoord.xy/iResolution.xy*2. - 1.;
          p.x *= iResolution.x/iResolution.y*0.95;
          mo = 2.0*iMouse.xy/iResolution.xy;
          mo = (mo==vec2(.0))?mo=vec2(0.5,2.):mo;
          mo.x += iTime*0.01;

          vec3 ro = 4.0*normalize(vec3(cos(2.75-3.0*mo.x), sin(iTime*0.22)*0.2, sin(2.75-3.0*mo.x)));
          vec3 eye = normalize(vec3(0) - ro);
          vec3 rgt = normalize(cross(vec3(0,1,0), eye));
          vec3 up = cross(eye,rgt);
          vec3 rd = normalize(p.x*rgt + p.y*up + 2.3*eye);

          vec4 col = vmarch(ro, rd);
          vec4 fragColor = vec4(col.rgb, 1.0);
          return fragColor;
      }

      void main() {
          gl_FragColor = mainImage(vUv * iResolution.xy);
      }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // --- Render targets for temporal blending ---
    const rtOpts: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    let rtPrev = new THREE.WebGLRenderTarget(1, 1, rtOpts);
    let rtCurr = new THREE.WebGLRenderTarget(1, 1, rtOpts);

    // --- Cheap blit material that mixes prev/curr ---
    const blitMaterial = new THREE.ShaderMaterial({
      uniforms: {
        a: { value: null },
        b: { value: null },
        f: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D a, b;
        uniform float f;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(texture2D(a, vUv).rgb, texture2D(b, vUv).rgb, f), 1.0);
        }
      `,
    });
    const blitScene = new THREE.Scene();
    const blitMesh = new THREE.Mesh(geometry, blitMaterial);
    blitScene.add(blitMesh);

    let lastTick = 0;
    const clock = new THREE.Clock();

    const renderShaderFrame = (now: number) => {
      [rtPrev, rtCurr] = [rtCurr, rtPrev];
      material.uniforms.iTime.value = clock.getElapsedTime() * SPEED;
      renderer.setRenderTarget(rtCurr);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      lastTick = now;
    };

    const present = (now: number) => {
      blitMaterial.uniforms.a.value = rtPrev.texture;
      blitMaterial.uniforms.b.value = rtCurr.texture;
      blitMaterial.uniforms.f.value = Math.min(
        Math.max((now - lastTick) / interval, 0),
        1,
      );
      renderer.render(blitScene, camera);
    };

    // --- Resize handling ---
    const handleResize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setPixelRatio(1);
      renderer.setSize(w, h);
      rtPrev.setSize(w, h);
      rtCurr.setSize(w, h);
      material.uniforms.iResolution.value.set(w, h, 1);
      const now = performance.now();
      renderShaderFrame(now);
      renderShaderFrame(now);
      present(now);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    // --- Animation loop ---
    let animationId: number;
    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      if (document.hidden) return;
      if (now - lastTick >= interval - 2) renderShaderFrame(now);
      present(now);
    };
    animationId = requestAnimationFrame(animate);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      blitMaterial.dispose();
      rtPrev.dispose();
      rtCurr.dispose();
      noiseTexture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 blur-md"
    />
  );
}
