
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertCircle,
  ArrowRight,
  HandCoins,
  PackageCheck,
  PackageOpen,
  ToyBrick,
  Undo2,
} from 'lucide-react'
import { Button } from '../ui/button'

type ActionItemsProps = {
  data: {
    myActiveProjects: any[]
    reimbursements: any[]
  }
}

export function ActionItems({ data }: ActionItemsProps) {
  const hasActiveProjects = data.myActiveProjects.length > 0
  const hasPendingReimbursements = data.reimbursements.length > 0
  const hasActions = hasActiveProjects || hasPendingReimbursements

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Action Items</CardTitle>
        <CardDescription>
          A checklist of items that require your attention.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasActions ? (
          <ul className="space-y-4">
            {data.myActiveProjects.map((project) => {
              const isPendingStart = project.status === 'approved';
              const isPendingApproval = project.status === 'pending_approval';
              const iconColor = isPendingApproval ? 'text-yellow-500' : isPendingStart ? 'text-blue-500' : 'text-sky-500';
              return (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <ToyBrick className={`h-5 w-5 ${iconColor}`} />
                    <div>
                      <p className="font-medium">
                        {project.title}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        Status: {project.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <Button variant="outline" size="sm">
                      View Project <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </li>
              )
            })}
             {data.reimbursements.map((req) => (
                <li
                  key={req.id}
                  className="flex items-center justify-between gap-4 rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <HandCoins className="h-5 w-5 text-green-500" />
                    <div>
                       <p className="font-medium">
                        Reimbursement:{' '}
                         <span className='font-mono'>₹{req.amount.toFixed(2)}</span>
                      </p>
                       <p className="text-xs text-muted-foreground capitalize">
                        Status: {req.status}
                      </p>
                    </div>
                  </div>
                   <Link href="/dashboard/reimbursements">
                    <Button variant="outline" size="sm">
                      View Details <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </li>
              ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-8 text-center text-muted-foreground">
            <PackageCheck className="h-10 w-10" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm">You have no pending action items.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
