import type { OrderContentWidth } from "./orderUi";
import { orderContentWidthClass } from "./orderUi";

export type OrderShellProps = {
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
  contentWidth?: OrderContentWidth;
  className?: string;
};

export function OrderShell({
  children,
  bottomBar,
  contentWidth = "narrow",
  className = "",
}: OrderShellProps) {
  return (
    <div
      className={`flex min-h-screen flex-col bg-surface ${bottomBar ? "pb-36" : ""} ${className}`}
    >
      <div
        className={`flex flex-1 flex-col px-4 pt-8 ${orderContentWidthClass(contentWidth)}`}
      >
        {children}
      </div>
      {bottomBar}
    </div>
  );
}
