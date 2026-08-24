import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/regularization_provider.dart';

class ApplyRegularizationSheet extends StatefulWidget {
  final DateTime? initialDate;
  const ApplyRegularizationSheet({super.key, this.initialDate});

  @override
  State<ApplyRegularizationSheet> createState() => _ApplyRegularizationSheetState();
}

// Backward compatibility typedef
typedef ApplyRegularizationDialog = ApplyRegularizationSheet;

class _ApplyRegularizationSheetState extends State<ApplyRegularizationSheet> {
  final _formKey = GlobalKey<FormState>();
  late DateTime _requestDate;
  String _requestType = 'Late Coming';
  String _punchTarget = 'in';
  final bool _waivePenalty = true;
  TimeOfDay _inTime = const TimeOfDay(hour: 9, minute: 30);
  TimeOfDay _outTime = const TimeOfDay(hour: 18, minute: 30);
  final _reasonController = TextEditingController();
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _requestDate = widget.initialDate ?? DateTime.now().subtract(const Duration(days: 1));
  }

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _requestDate,
      firstDate: DateTime.now().subtract(const Duration(days: 60)),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF0D9488),
              onPrimary: Colors.white,
              surface: Color(0xFF1E293B),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() => _requestDate = picked);
    }
  }

  Future<void> _pickTime(bool isIn) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isIn ? _inTime : _outTime,
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Color(0xFF0D9488),
              onPrimary: Colors.white,
              surface: Color(0xFF1E293B),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        if (isIn) {
          _inTime = picked;
        } else {
          _outTime = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final auth = context.read<AuthProvider>();
    if (auth.user?.employeeId == null) return;

    setState(() => _submitting = true);
    final regProvider = context.read<RegularizationProvider>();

    final dateStr = DateFormat('yyyy-MM-dd').format(_requestDate);
    final inStr = '${_inTime.hour.toString().padLeft(2, '0')}:${_inTime.minute.toString().padLeft(2, '0')}';
    final outStr = '${_outTime.hour.toString().padLeft(2, '0')}:${_outTime.minute.toString().padLeft(2, '0')}';

    final success = await regProvider.applyRegularization(
      employeeId: auth.user!.employeeId!,
      requestDate: dateStr,
      requestType: _requestType,
      punchTarget: _punchTarget,
      punchTimeIn: _punchTarget == 'in' || _punchTarget == 'both' ? inStr : null,
      punchTimeOut: _punchTarget == 'out' || _punchTarget == 'both' ? outStr : null,
      reason: _reasonController.text.trim(),
      waivePenalty: _waivePenalty,
    );

    setState(() => _submitting = false);
    if (!mounted) return;

    if (success) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Regularization request submitted successfully!'),
          backgroundColor: Color(0xFF059669),
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(regProvider.error ?? 'Failed to submit regularization.'),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        top: 16,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: Color(0xFF1E293B),
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),

              // Title & Close Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Regularize Attendance',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white60),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Date of Attendance
              const Text('Date of Attendance', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 6),
              GestureDetector(
                onTap: _pickDate,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.calendar_today, color: Color(0xFF0D9488), size: 16),
                      const SizedBox(width: 8),
                      Text(
                        DateFormat('dd MMM yyyy (EEEE)').format(_requestDate),
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Request Type Dropdown
              const Text('Request Type', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white12),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _requestType,
                    dropdownColor: const Color(0xFF0F172A),
                    isExpanded: true,
                    icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white70),
                    items: const [
                      DropdownMenuItem(value: 'Late Coming', child: Text('Late Coming', style: TextStyle(color: Colors.white, fontSize: 13))),
                      DropdownMenuItem(value: 'Early Go', child: Text('Early Go', style: TextStyle(color: Colors.white, fontSize: 13))),
                      DropdownMenuItem(value: 'Missed Punch', child: Text('Missed Punch', style: TextStyle(color: Colors.white, fontSize: 13))),
                      DropdownMenuItem(value: 'Outdoor / On Duty', child: Text('Outdoor / On Duty', style: TextStyle(color: Colors.white, fontSize: 13))),
                    ],
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _requestType = val;
                          if (val == 'Late Coming') {
                            _punchTarget = 'in';
                          } else if (val == 'Early Go') {
                            _punchTarget = 'out';
                          } else {
                            _punchTarget = 'both';
                          }
                        });
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Punch to Correct (Segmented selection like Leave Day Type)
              const Text('Punch to Correct', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 6),
              Row(
                children: [
                  _buildSegmentOption('in', 'In Only'),
                  _buildSegmentOption('out', 'Out Only'),
                  _buildSegmentOption('both', 'Both (In & Out)'),
                ],
              ),
              const SizedBox(height: 16),

              // Time Pickers
              Row(
                children: [
                  if (_punchTarget == 'in' || _punchTarget == 'both')
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Correct In Time', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () => _pickTime(true),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.white12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.access_time, color: Color(0xFF0D9488), size: 16),
                                  const SizedBox(width: 8),
                                  Text(
                                    _inTime.format(context),
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  if (_punchTarget == 'both') const SizedBox(width: 12),
                  if (_punchTarget == 'out' || _punchTarget == 'both')
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Correct Out Time', style: TextStyle(color: Colors.white70, fontSize: 13)),
                          const SizedBox(height: 6),
                          GestureDetector(
                            onTap: () => _pickTime(false),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: Colors.white12),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.access_time, color: Color(0xFF0D9488), size: 16),
                                  const SizedBox(width: 8),
                                  Text(
                                    _outTime.format(context),
                                    style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Reason
              const Text('Reason / Remarks', style: TextStyle(color: Colors.white70, fontSize: 13)),
              const SizedBox(height: 6),
              TextFormField(
                controller: _reasonController,
                maxLines: 3,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Explain the reason for regularization...',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Colors.white12),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Colors.white12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Color(0xFF0D9488)),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Please enter a reason for regularization';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0D9488),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text(
                          'Submit Regularization Request',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSegmentOption(String value, String label) {
    final isSelected = _punchTarget == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _punchTarget = value),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF0D9488) : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? const Color(0xFF0D9488) : Colors.white12,
            ),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.white70,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ),
      ),
    );
  }
}
