import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/loan_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/loan_provider.dart';
import 'apply_loan_sheet.dart';

class LoansScreen extends StatefulWidget {
  const LoansScreen({super.key});

  @override
  State<LoansScreen> createState() => _LoansScreenState();
}

class _LoansScreenState extends State<LoansScreen> {
  final _currency = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = context.read<AuthProvider>();
      context.read<LoanProvider>().fetchAllLoanData(employeeId: auth.user?.employeeId);
    });
  }

  void _openApplySheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ApplyLoanSheet(),
    );
  }

  void _viewEmiSchedule(LoanModel loan, bool isDark, Color cardBg, Color textPrimary, Color textSecondary, Color borderCol) {
    showModalBottomSheet(
      context: context,
      backgroundColor: cardBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('EMI Schedule — ${loan.loanNumber}', style: TextStyle(color: textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text('${loan.loanTypeName} • ${_currency.format(loan.principalAmount)}', style: TextStyle(color: textSecondary, fontSize: 12)),
                  ],
                ),
                IconButton(icon: Icon(Icons.close, color: textSecondary), onPressed: () => Navigator.pop(ctx)),
              ],
            ),
            const SizedBox(height: 16),
            if (loan.schedule.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text('No EMI installment records found.', style: TextStyle(color: textSecondary))),
              )
            else
              Flexible(
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: loan.schedule.length,
                  separatorBuilder: (_, __) => Divider(color: borderCol),
                  itemBuilder: (context, idx) {
                    final emi = loan.schedule[idx];
                    final isPaid = emi.status.toLowerCase() == 'paid';
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        radius: 14,
                        backgroundColor: isPaid ? const Color(0xFF059669).withValues(alpha: 0.2) : Colors.amber.withValues(alpha: 0.2),
                        child: Text('${emi.installmentNumber}', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: isPaid ? const Color(0xFF059669) : Colors.amber.shade700)),
                      ),
                      title: Text(_currency.format(emi.emiAmount), style: TextStyle(color: textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
                      subtitle: Text('Due: ${emi.dueDate}', style: TextStyle(color: textSecondary, fontSize: 11)),
                      trailing: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: (isPaid ? const Color(0xFF059669) : Colors.amber).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          emi.status,
                          style: TextStyle(
                            color: isPaid ? const Color(0xFF059669) : Colors.amber.shade700,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loanProvider = context.watch<LoanProvider>();
    final loans = loanProvider.myLoans;
    final active = loanProvider.activeLoan;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;
    final textPrimary = isDark ? Colors.white : const Color(0xFF0F172A);
    final textSecondary = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
    final borderCol = isDark ? Colors.white10 : const Color(0xFFE2E8F0);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: loanProvider.loading && loans.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
          : RefreshIndicator(
              color: const Color(0xFF0D9488),
              onRefresh: () => loanProvider.fetchAllLoanData(employeeId: auth.user?.employeeId),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header with Apply Button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Loans & Advances',
                          style: TextStyle(
                            color: textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0D9488),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Request Loan', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                          onPressed: _openApplySheet,
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Active Loan Hero Card
                    if (active != null) ...[
                      _buildActiveLoanCard(active, isDark, textPrimary, textSecondary),
                      const SizedBox(height: 24),
                    ],

                    // Loan History
                    Text(
                      'Application History',
                      style: TextStyle(
                        color: textPrimary,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),

                    if (loans.isEmpty)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: cardBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: borderCol),
                        ),
                        child: Center(
                          child: Text('No loan applications on record.', style: TextStyle(color: textSecondary, fontSize: 13)),
                        ),
                      )
                    else
                      ListView.separated(
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: loans.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (ctx, i) {
                          final l = loans[i];
                          Color statusColor;
                          switch (l.status) {
                            case 'Approved':
                            case 'Active':
                              statusColor = const Color(0xFF059669);
                              break;
                            case 'Completed':
                              statusColor = Colors.blueAccent;
                              break;
                            case 'Rejected':
                              statusColor = const Color(0xFFDC2626);
                              break;
                            default:
                              statusColor = Colors.amber;
                          }

                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: borderCol),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(l.loanNumber, style: TextStyle(color: textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: statusColor.withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(l.status, style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(l.loanTypeName, style: TextStyle(color: textSecondary, fontSize: 11)),
                                        const SizedBox(height: 2),
                                        Text(_currency.format(l.principalAmount), style: TextStyle(color: textPrimary, fontSize: 15, fontWeight: FontWeight.bold)),
                                      ],
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text('${l.tenureMonths} Months (${_currency.format(l.emiAmount)}/mo)', style: TextStyle(color: textSecondary, fontSize: 12)),
                                        const SizedBox(height: 2),
                                        Text('Start: ${l.startDate}', style: TextStyle(color: textSecondary, fontSize: 11)),
                                      ],
                                    ),
                                  ],
                                ),
                                if (l.schedule.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Align(
                                    alignment: Alignment.centerRight,
                                    child: TextButton.icon(
                                      style: TextButton.styleFrom(padding: EdgeInsets.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
                                      icon: const Icon(Icons.table_chart_outlined, size: 14, color: Color(0xFF0D9488)),
                                      label: const Text('View Repayments', style: TextStyle(color: Color(0xFF0D9488), fontSize: 12)),
                                      onPressed: () => _viewEmiSchedule(l, isDark, cardBg, textPrimary, textSecondary, borderCol),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildActiveLoanCard(LoanModel loan, bool isDark, Color textPrimary, Color textSecondary) {
    final paidPercent = loan.totalAmount > 0 ? (loan.paidAmount / loan.totalAmount).clamp(0.0, 1.0) : 0.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDark
              ? const [Color(0xFF1E293B), Color(0xFF0F172A)]
              : const [Color(0xFFF0FDFA), Colors.white],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF0D9488).withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.2 : 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF0D9488).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  loan.loanTypeName,
                  style: const TextStyle(color: Color(0xFF0D9488), fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
              Text(
                'EMI: ${_currency.format(loan.emiAmount)} / mo',
                style: TextStyle(color: textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text('Remaining Balance', style: TextStyle(color: textSecondary, fontSize: 12)),
          const SizedBox(height: 2),
          Text(
            _currency.format(loan.balanceAmount),
            style: TextStyle(color: textPrimary, fontSize: 28, fontWeight: FontWeight.bold, letterSpacing: -0.5),
          ),
          const SizedBox(height: 14),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: paidPercent,
              minHeight: 8,
              backgroundColor: isDark ? Colors.white12 : const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF0D9488)),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${(paidPercent * 100).toInt()}% Paid', style: TextStyle(color: textSecondary, fontSize: 11)),
              Text('Sanctioned: ${_currency.format(loan.principalAmount)}', style: TextStyle(color: textSecondary, fontSize: 11)),
            ],
          ),
        ],
      ),
    );
  }
}
