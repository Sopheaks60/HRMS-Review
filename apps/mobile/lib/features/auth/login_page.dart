import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "../../core/network/api_client.dart";

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final email = TextEditingController();
  final password = TextEditingController();
  final tenant = TextEditingController(text: "demo");
  final api = ApiClient();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("ចូល KromPay")),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          TextField(controller: tenant, decoration: const InputDecoration(labelText: "កូដក្រុមហ៊ុន")),
          TextField(controller: email, decoration: const InputDecoration(labelText: "អ៊ីមែល")),
          TextField(controller: password, obscureText: true, decoration: const InputDecoration(labelText: "ពាក្យសម្ងាត់")),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: () async {
              await api.login(email.text, password.text, tenant.text);
              if (context.mounted) context.go("/");
            },
            child: const Text("ចូលប្រព័ន្ធ"),
          ),
        ]),
      ),
    );
  }
}
