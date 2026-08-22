import 'package:flutter_test/flutter_test.dart';
import 'package:hrdesk_mobile/main.dart';

void main() {
  testWidgets('Splash screen renders', (WidgetTester tester) async {
    await tester.pumpWidget(const HRDeskApp());
    expect(find.text('HRDesk'), findsOneWidget);
  });
}
