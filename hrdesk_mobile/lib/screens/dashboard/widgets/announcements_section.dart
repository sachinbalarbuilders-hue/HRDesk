import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../models/dashboard_model.dart';
import '../../../core/api_client.dart';

class AnnouncementsSection extends StatelessWidget {
  final List<AnnouncementModel> announcements;
  final bool isDark;
  final Color cardBg;
  final Color cardBorder;
  final Color textPrimary;
  final Color textSecondary;

  const AnnouncementsSection({
    super.key,
    required this.announcements,
    required this.isDark,
    required this.cardBg,
    required this.cardBorder,
    required this.textPrimary,
    required this.textSecondary,
  });

  String _buildMediaUrl(String path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    final base =
        ApiClient().dio.options.baseUrl.replaceAll(RegExp(r'/api/?$'), '');
    return '$base$path';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.campaign_rounded,
                color: Color(0xFF0284C7), size: 18),
            const SizedBox(width: 8),
            Text(
              'Company Announcements',
              style: TextStyle(
                  color: textPrimary,
                  fontSize: 15,
                  fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (announcements.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: cardBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.campaign_outlined,
                    color: Color(0xFF0284C7), size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'All Caught Up',
                        style: TextStyle(
                            color: textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'No active company notices or upcoming holiday announcements.',
                        style: TextStyle(color: textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: announcements
                    .any((a) => a.imagePath != null || a.videoPath != null)
                ? 180
                : 115,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: announcements.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (ctx, i) {
                final a = announcements[i];
                final isHoliday = a.category.toLowerCase().contains('holiday');
                final hasMedia = a.imagePath != null || a.videoPath != null;

                return Container(
                  width: 280,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: cardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: isHoliday
                          ? const Color(0xFF10B981).withValues(alpha: 0.5)
                          : cardBorder,
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Media thumbnail
                      if (a.imagePath != null)
                        GestureDetector(
                          onTap: () => _showMediaDialog(context, a),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(10),
                            child: Image.network(
                              _buildMediaUrl(a.imagePath!),
                              height: 60,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  const SizedBox.shrink(),
                            ),
                          ),
                        )
                      else if (a.videoPath != null)
                        GestureDetector(
                          onTap: () => _showMediaDialog(context, a),
                          child: Container(
                            height: 60,
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: isDark
                                  ? const Color(0xFF1E293B)
                                  : const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Center(
                              child: Icon(Icons.play_circle_fill,
                                  size: 32, color: Color(0xFF0D9488)),
                            ),
                          ),
                        ),
                      if (hasMedia) const SizedBox(height: 8),

                      // Category + date row
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 7, vertical: 2),
                            decoration: BoxDecoration(
                              color: isHoliday
                                  ? const Color(0xFF10B981)
                                      .withValues(alpha: 0.15)
                                  : const Color(0xFF0284C7)
                                      .withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              a.category.toUpperCase(),
                              style: TextStyle(
                                color: isHoliday
                                    ? const Color(0xFF059669)
                                    : const Color(0xFF0284C7),
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          Text(
                            a.date,
                            style:
                                TextStyle(color: textSecondary, fontSize: 10),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        a.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: textPrimary,
                            fontSize: 13,
                            fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Expanded(
                        child: Text(
                          a.message,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: textSecondary, fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  void _showMediaDialog(BuildContext context, AnnouncementModel a) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Close button
            Align(
              alignment: Alignment.topRight,
              child: IconButton(
                icon: const Icon(Icons.close, color: Colors.white, size: 28),
                onPressed: () => Navigator.pop(ctx),
              ),
            ),
            if (a.imagePath != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  _buildMediaUrl(a.imagePath!),
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Text(
                      'Failed to load image',
                      style: TextStyle(color: Colors.white)),
                ),
              )
            else if (a.videoPath != null)
              Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.black87,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.play_circle_fill,
                            color: Color(0xFF0D9488), size: 56),
                        const SizedBox(height: 12),
                        Text(
                          a.title,
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.bold),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: () async {
                            Navigator.pop(ctx);
                            final url = Uri.parse(_buildMediaUrl(a.videoPath!));
                            if (await canLaunchUrl(url)) {
                              await launchUrl(url,
                                  mode: LaunchMode.externalApplication);
                            }
                          },
                          icon: const Icon(Icons.open_in_new, size: 16),
                          label: const Text('Open Video'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0D9488),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
