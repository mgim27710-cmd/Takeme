import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// 다음 카카오 우편번호 / 도로명 주소 검색 웹뷰 화면
class DaumPostcodeScreen extends StatefulWidget {
  const DaumPostcodeScreen({super.key});

  @override
  State<DaumPostcodeScreen> createState() => _DaumPostcodeScreenState();
}

class _DaumPostcodeScreenState extends State<DaumPostcodeScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  static const String _htmlContent = '''
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>도로명 주소 검색</title>
  <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; background: #ffffff; }
    #postcode-layer { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="postcode-layer"></div>
  <script>
    function notifyFlutter(data) {
      try {
        if (window.PostcodeChannel) {
          window.PostcodeChannel.postMessage(JSON.stringify(data));
        }
      } catch (e) {}
    }
    new daum.Postcode({
      oncomplete: function(data) {
        notifyFlutter(data);
      },
      onclose: function(state) {
        if (state === 'FORCE_CLOSE') {
          notifyFlutter({ closed: true });
        }
      },
      width: '100%',
      height: '100%'
    }).embed(document.getElementById('postcode-layer'));
  </script>
</body>
</html>
''';

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoading = false);
          },
        ),
      )
      ..addJavaScriptChannel(
        'PostcodeChannel',
        onMessageReceived: (JavaScriptMessage message) {
          try {
            final data = jsonDecode(message.message) as Map<String, dynamic>;
            Navigator.pop(context, data);
          } catch (e) {
            debugPrint('[DaumPostcode] parse error: $e');
            Navigator.pop(context);
          }
        },
      )
      ..loadHtmlString(_htmlContent, baseUrl: 'https://postcode.map.daum.net');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          '도로명 주소 검색',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0F172A)),
        ),
        backgroundColor: Colors.white,
        elevation: 0.5,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Color(0xFF334155)),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(color: Color(0xFF2563EB)),
            ),
        ],
      ),
    );
  }
}
