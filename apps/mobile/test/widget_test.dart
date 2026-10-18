import "package:flutter_test/flutter_test.dart";
import "package:krompay/main.dart";

void main() {
  testWidgets("renders ESS home", (tester) async {
    await tester.pumpWidget(const KromPayApp());
    expect(find.text("KromPay ESS"), findsOneWidget);
  });
}
