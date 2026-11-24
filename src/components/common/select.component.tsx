import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: number | string;
}

export interface SelectInputProps {
  options: SelectOption[];
  value?: number | string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  size?: 'sm' | 'default';
}

export default function SelectInput({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className,
  id,
  disabled,
  size = 'default',
}: SelectInputProps) {

  return (
    <Select value={value?.toString()} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        disabled={disabled}
        size={size}
        className={cn('w-full min-w-0', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value.toString()}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}