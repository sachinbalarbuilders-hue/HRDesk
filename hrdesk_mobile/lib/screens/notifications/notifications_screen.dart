import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/notification_provider.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final notifProvider = context.watch<NotificationProvider>();
    final notifications = notifProvider.notifications;

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1E293B),
        foregroundColor: Colors.white,
        title: const Text('Notifications', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
      ),
      body: notifications.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.notifications_none, color: Colors.white24, size: 56),
                  SizedBox(height: 16),
                  Text('No notifications yet', style: TextStyle(color: Colors.white60, fontSize: 14)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: notifications.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (ctx, i) {
                final n = notifications[i];
                return GestureDetector(
                  onTap: () {
                    if (!n.isRead) {
                      notifProvider.markAsRead(n.id);
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: n.isRead ? const Color(0xFF1E293B) : const Color(0xFF1E293B).withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: n.isRead ? Colors.white10 : const Color(0xFF0D9488).withValues(alpha: 0.5),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: const Color(0xFF0D9488).withValues(alpha: 0.2),
                          child: const Icon(Icons.notifications, color: Color(0xFF0D9488), size: 16),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    n.title,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: n.isRead ? FontWeight.w600 : FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                                  Text(n.createdAt, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                n.message,
                                style: const TextStyle(color: Colors.white70, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
    );
  }
}
