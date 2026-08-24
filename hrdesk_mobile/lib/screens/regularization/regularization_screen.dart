import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/regularization_provider.dart';
import 'apply_regularization_dialog.dart';

class RegularizationScreen extends StatefulWidget {
  const RegularizationScreen({super.key});

  @override
  State<RegularizationScreen> createState() => _RegularizationScreenState();
}

class _RegularizationScreenState extends State<RegularizationScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RegularizationProvider>().fetchRegularizations();
    });
  }

  void _openApplyDialog() {
    showDialog(
      context: context,
      builder: (_) => const ApplyRegularizationDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final regProvider = context.watch<RegularizationProvider>();
    final requests = regProvider.myRequests;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        title: const Text('Attendance Regularization', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline, color: Color(0xFF0D9488)),
            onPressed: _openApplyDialog,
          ),
        ],
      ),
      body: regProvider.loading && requests.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)))
          : RefreshIndicator(
              color: const Color(0xFF0D9488),
              onRefresh: () => regProvider.fetchRegularizations(),
              child: requests.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.edit_calendar, color: Colors.white24, size: 56),
                          const SizedBox(height: 16),
                          const Text('No regularization requests found', style: TextStyle(color: Colors.white60, fontSize: 14)),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0D9488),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _openApplyDialog,
                            child: const Text('Apply Regularization', style: TextStyle(color: Colors.white)),
                          ),
                        ],
                      ),
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: requests.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (ctx, i) {
                        final item = requests[i];
                        Color statusColor;
                        switch (item.status) {
                          case 'Approved':
                            statusColor = const Color(0xFF059669);
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
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0D9488).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      item.requestType,
                                      style: const TextStyle(color: Color(0xFF0D9488), fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: statusColor.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      item.status,
                                      style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Date: ${item.requestDate}',
                                style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  if (item.punchTimeIn != null)
                                    Text('In: ${item.punchTimeIn}  ', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                                  if (item.punchTimeOut != null)
                                    Text('Out: ${item.punchTimeOut}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                                ],
                              ),
                              if (item.reason != null && item.reason!.isNotEmpty) ...[
                                const SizedBox(height: 6),
                                Text(
                                  item.reason!,
                                  style: const TextStyle(color: Colors.white60, fontSize: 12),
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
            ),
    );
  }
}
