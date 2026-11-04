import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_parent/main.dart';

void main() {
  testWidgets('TakeMeParentApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TakeMeParentApp());
    expect(find.byType(TakeMeParentApp), findsOneWidget);
  });
}
