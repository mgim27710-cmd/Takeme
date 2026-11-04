import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_driver/main.dart';

void main() {
  testWidgets('TakeMeDriverApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TakeMeDriverApp());
    expect(find.byType(TakeMeDriverApp), findsOneWidget);
  });
}
