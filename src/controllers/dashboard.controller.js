import orderRepository from '../modules/storefront/order.repository.js';
import { asyncHandler } from '../common/utils/asyncHandler.js';

class DashboardController {
  // GET /admin/dashboard (DSH01)
  static getDashboard = asyncHandler(async (req, res) => {
    const { from, to, timezone } = req.query;

    const data = await orderRepository.getDashboardSummary({
      from,
      to,
      timezone,
    });

    return res.status(200).json({
      status: 'success',
      data,
    });
  });

  // GET /admin/reports/sales (REP01)
  static getSalesReport = asyncHandler(async (req, res) => {
    const { year, from, to, group_by, timezone, date_basis, format } = req.query;

    const report = await orderRepository.getSalesReport({
      year,
      from,
      to,
      group_by,
      timezone,
      date_basis,
    });

    if (format === 'csv') {
      // Xuất file CSV
      const headers = [
        'period_start',
        'period_end',
        'label',
        'order_count',
        'completed_order_count',
        'revenue',
        'held_amount',
        'refunded_amount',
      ];
      const rows = report.rows.map((r) => [
        r.period_start,
        r.period_end,
        `"${r.label}"`,
        r.order_count,
        r.completed_order_count,
        r.revenue,
        r.held_amount,
        r.refunded_amount,
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sales_report_${year || 'current'}.csv"`);
      return res.status(200).send(csvContent);
    }

    return res.status(200).json({
      status: 'success',
      data: report,
    });
  });
}

export default DashboardController;
