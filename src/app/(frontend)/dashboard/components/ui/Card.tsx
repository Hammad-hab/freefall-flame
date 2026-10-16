import { ReactNode } from "react";

function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-[32px] border border-white/[0.07] bg-[#1e1a14] ${className}`}>{children}</div>
  );
}

const Icon = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);


const Arrow = () => <Icon d="M7 17L17 7M9 7h8v8" className="h-4 w-4" />;


export {
  Card, 
  Arrow,
  Icon
}