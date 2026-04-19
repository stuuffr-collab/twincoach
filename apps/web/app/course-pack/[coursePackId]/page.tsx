import { CoursePackWorkspace } from "@/src/components/course-pack-workspace";

type CoursePackWorkspacePageProps = {
  params: Promise<{
    coursePackId: string;
  }>;
};

export default async function CoursePackWorkspacePage({
  params,
}: CoursePackWorkspacePageProps) {
  const resolvedParams = await params;

  return <CoursePackWorkspace coursePackId={resolvedParams.coursePackId} />;
}
