import { createFileRoute } from '@tanstack/react-router'

import { CourseDetailScreen } from '@/features/courses/course-detail-screen'

export const Route = createFileRoute('/_app/courses/$courseId')({
  component: CourseRoute,
})

function CourseRoute() {
  const { courseId } = Route.useParams()
  return <CourseDetailScreen courseId={courseId} />
}
