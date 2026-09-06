import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  value: string | number;
};

export function ItemMeta({ icon, value }: Props) {
  return (
    <span className="item-meta">
      {icon}
      {value}
    </span>
  );
}
