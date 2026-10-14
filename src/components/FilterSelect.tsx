import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import s from "./FilterSelect.module.scss";
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className={s.trigger} aria-label={label}>
        <Select.Value />
        <Select.Icon>
          <ChevronDown size={16} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className={s.content} position="popper" sideOffset={6}>
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item key={o.value} value={o.value} className={s.item}>
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
