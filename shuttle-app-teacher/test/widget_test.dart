import 'package:flutter_test/flutter_test.dart';
import 'package:shuttle_app_teacher/main.dart';

void main() {
  testWidgets('TakeMeTeacherApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TakeMeTeacherApp());
    expect(find.byType(TakeMeTeacherApp), findsOneWidget);
  });
}
