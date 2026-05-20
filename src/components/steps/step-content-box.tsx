import { cn } from '@/lib/utils'

interface StepContentBoxProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function StepContentBox({ children, className, ...props }: StepContentBoxProps) {
  return (
    <div className={cn('min-h-[16rem] sm:min-h-[26rem]', className)} {...props}>
      {children}
    </div>
  )
}
