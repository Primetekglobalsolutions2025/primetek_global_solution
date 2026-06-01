import { getAssignedProfilesWithMetrics, getMetricsHistory } from './actions';
import DailyReportClient from './DailyReportClient';

export const metadata = {
  title: 'Daily Report - PrimeTek Portal',
  description: 'Submit and view daily recruitment reports per assigned profile.',
};

export default async function DailyReportPage() {
  const { profiles, todayMetrics, reportDate } = await getAssignedProfilesWithMetrics();
  const history = await getMetricsHistory(7);

  return (
    <div className="space-y-4">
      <DailyReportClient 
        profiles={profiles}
        todayMetrics={todayMetrics}
        history={history}
        reportDate={reportDate}
      />
    </div>
  );
}
