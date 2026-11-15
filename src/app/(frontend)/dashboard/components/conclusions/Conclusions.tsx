'use client'

/**
 * The Conclusions tab.
 *
 * Registered and reachable from the sidebar, but deliberately empty for now:
 * the pane renders nothing until the tab has content. Everything it will need
 * (the dataset, its parsed rows and the workspace links) already arrives via
 * TabData in ../workspace/tabs.tsx, so filling it in does not mean touching the
 * tab registry or the sidebar.
 */
export default function Conclusions() {
  return <div id="conclusions" data-conclusions />
}
