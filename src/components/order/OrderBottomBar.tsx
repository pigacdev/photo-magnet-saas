import type { OrderContentWidth } from "./orderUi";
import { orderContentWidthClass } from "./orderUi";

export type OrderBottomBarProps = {
  children: React.ReactNode;
  contentWidth?: OrderContentWidth;
};

export function OrderBottomBar({
  children,
  contentWidth = "narrow",
}: OrderBottomBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div
        className={`flex flex-col gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${orderContentWidthClass(contentWidth)}`}
      >
        {children}
      </div>
    </div>
  );
}
