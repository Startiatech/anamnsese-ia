import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface FormLabelProps extends React.ComponentPropsWithoutRef<typeof Label> {
  required?: boolean
}

export function FormLabel({ required, children, className, ...props }: FormLabelProps) {
  return (
    <Label className={cn(className)} {...props}>
      {children}
      {required && (
        <span className="ml-1 text-violet-400" aria-hidden="true">*</span>
      )}
    </Label>
  )
}
