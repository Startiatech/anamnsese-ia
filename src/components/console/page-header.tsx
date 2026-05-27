import { ConsoleBreadcrumb } from './console-breadcrumb'

interface PageHeaderProps {
  title: string
  description: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="pb-6 mb-2 border-b border-border">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <ConsoleBreadcrumb />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-3">{title}</h1>
          <p className="text-sm text-highlight mt-1">{description}</p>
        </div>
        {action && <div className="shrink-0 ml-4 mt-3">{action}</div>}
      </div>
    </div>
  )
}
