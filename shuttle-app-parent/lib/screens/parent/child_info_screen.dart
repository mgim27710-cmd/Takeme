import 'package:flutter/material.dart';
import '../../services/api_service.dart';

/// 원아·보호자 정보 입력 화면
///
/// 원장 웹의 [원아 추가] 와 같은 칸을 학부모가 직접 채운다.
/// - required = true: 가입 후 필수 칸이 비어 있을 때 홈 대신 먼저 보여준다. 뒤로 갈 수 없다.
/// - required = false: 설정에서 열어 고칠 때.
/// 보호자2(비상연락망)는 주보호자가 전화를 받지 못할 때 차량선생님이 연락할 사람이다.
class ChildInfoScreen extends StatefulWidget {
  final Map<String, dynamic> info; // 서버 /parent/child-info 응답 한 건
  final bool required;

  const ChildInfoScreen({super.key, required this.info, this.required = false});

  @override
  State<ChildInfoScreen> createState() => _ChildInfoScreenState();
}

class _ChildInfoScreenState extends State<ChildInfoScreen> {
  static const _relations = ['모', '부', '조모', '조부', '외조모', '외조부', '기타'];

  late String _gender;
  late final TextEditingController _age;
  late final TextEditingController _address;
  late final TextEditingController _parentName;
  late String _parentRelation;
  late final TextEditingController _parentPhone;
  late final TextEditingController _parent2Name;
  late String _parent2Relation;
  late final TextEditingController _parent2Phone;
  late final TextEditingController _allergies;
  late final TextEditingController _note;
  late final bool _addressLocked; // 이미 주소가 있으면 '탑승지 변경 신청'으로만 바꾼다
  bool _saving = false;
  String? _error;

  String _s(String key) => widget.info[key]?.toString().trim() ?? '';

  @override
  void initState() {
    super.initState();
    _gender = _s('gender');
    _age = TextEditingController(text: _s('age'));
    _address = TextEditingController(text: _s('address'));
    _addressLocked = _s('address').isNotEmpty;
    _parentName = TextEditingController(text: _s('parentName'));
    _parentRelation = _s('parentRelation');
    _parentPhone = TextEditingController(text: _s('parentPhone'));
    _parent2Name = TextEditingController(text: _s('parent2Name'));
    _parent2Relation = _s('parent2Relation');
    _parent2Phone = TextEditingController(text: _s('parent2Phone'));
    _allergies = TextEditingController(text: _s('allergies'));
    _note = TextEditingController(text: _s('parentNote'));
  }

  @override
  void dispose() {
    for (final c in [_age, _address, _parentName, _parentPhone, _parent2Name, _parent2Phone, _allergies, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _needsAddress => widget.info['isNotRiding'] != true && !_addressLocked;

  /// 비어 있는 필수 칸 이름
  List<String> _missing() {
    final m = <String>[];
    if (_gender.isEmpty) m.add('성별');
    if (_age.text.trim().isEmpty) m.add('연령');
    if (_needsAddress && _address.text.trim().isEmpty) m.add('집 주소');
    if (_parentName.text.trim().isEmpty) m.add('주보호자 성함');
    if (_parentRelation.isEmpty) m.add('주보호자 관계');
    if (_parentPhone.text.trim().isEmpty) m.add('주보호자 연락처');
    if (_parent2Name.text.trim().isEmpty) m.add('비상연락망 성함');
    if (_parent2Relation.isEmpty) m.add('비상연락망 관계');
    if (_parent2Phone.text.trim().isEmpty) m.add('비상연락망 연락처');
    if (_allergies.text.trim().isEmpty) m.add('알레르기');
    return m;
  }

  Future<void> _save() async {
    final missing = _missing();
    if (missing.isNotEmpty) {
      setState(() => _error = '다음 칸을 입력해 주세요: ${missing.join(', ')}');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final res = await ApiService().saveChildInfo({
      'studentId': widget.info['studentId'],
      'gender': _gender,
      'age': _age.text.trim(),
      if (_needsAddress) 'address': _address.text.trim(),
      'parentName': _parentName.text.trim(),
      'parentRelation': _parentRelation,
      'parentPhone': _parentPhone.text.trim(),
      'parent2Name': _parent2Name.text.trim(),
      'parent2Relation': _parent2Relation,
      'parent2Phone': _parent2Phone.text.trim(),
      'allergies': _allergies.text.trim(),
      'parentNote': _note.text.trim(),
    });
    if (!mounted) return;
    setState(() => _saving = false);
    if (res['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('원아·보호자 정보를 저장했습니다.'), backgroundColor: Color(0xFF10B981)),
      );
      Navigator.pop(context, true);
    } else {
      setState(() => _error = res['message']?.toString() ?? '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  // ───────────── 화면 조각 ─────────────

  Widget _section(String title, {String? help, required List<Widget> children}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
          if (help != null) ...[
            const SizedBox(height: 4),
            Text(help, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4)),
          ],
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _label(String text, {bool required = true}) => Padding(
        padding: const EdgeInsets.only(bottom: 6, top: 4),
        child: Text.rich(TextSpan(children: [
          TextSpan(text: text, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF334155))),
          if (required) const TextSpan(text: ' *', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w800)),
        ])),
      );

  Widget _field(TextEditingController c, String hint, {TextInputType? keyboard, int maxLines = 1}) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: TextField(
          controller: c,
          keyboardType: keyboard,
          maxLines: maxLines,
          style: const TextStyle(fontSize: 16),
          decoration: InputDecoration(
            hintText: hint,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      );

  Widget _choices(List<String> options, String value, ValueChanged<String> onChanged) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: options
              .map((o) => ChoiceChip(
                    label: Text(o, style: const TextStyle(fontSize: 15)),
                    selected: value == o,
                    onSelected: (_) => setState(() => onChanged(o)),
                  ))
              .toList(),
        ),
      );

  /// 관계: 목록에 없는 값(예: 이모)이 저장돼 있으면 그대로 보여준다
  List<String> _relationOptions(String current) =>
      current.isEmpty || _relations.contains(current) ? _relations : [..._relations, current];

  @override
  Widget build(BuildContext context) {
    final name = _s('name');
    final className = _s('className');
    final academy = _s('academyName');

    return PopScope(
      canPop: !widget.required,
      child: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        appBar: AppBar(
          automaticallyImplyLeading: !widget.required,
          title: const Text('원아·보호자 정보', style: TextStyle(fontWeight: FontWeight.w800)),
          backgroundColor: Colors.white,
          elevation: 0.5,
        ),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (widget.required)
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFFCD34D)),
                  ),
                  child: const Text(
                    '안전한 통학을 위해 아래 정보를 먼저 입력해 주세요. 입력을 마치면 앱을 이용할 수 있습니다.',
                    style: TextStyle(fontSize: 14, color: Color(0xFF92400E), height: 1.4, fontWeight: FontWeight.w600),
                  ),
                ),

              _section('원아', help: [academy, className].where((e) => e.isNotEmpty).join(' · '), children: [
                Text(name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                _label('성별'),
                _choices(const ['남', '여'], _gender, (v) => _gender = v),
                _label('연령'),
                _field(_age, '예: 만 4세 (6세반)'),
                _label('집 주소', required: _needsAddress),
                if (_addressLocked)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      '${_s('address')}\n주소를 바꾸려면 홈 화면의 탑승지 변경 신청을 이용해 주세요.',
                      style: const TextStyle(fontSize: 14, color: Color(0xFF475569), height: 1.4),
                    ),
                  )
                else if (widget.info['isNotRiding'] == true)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 10),
                    child: Text('셔틀을 타지 않는 원아입니다.', style: TextStyle(fontSize: 14, color: Color(0xFF475569))),
                  )
                else
                  _field(_address, '도로명 주소 (예: 경기도 양주시 광사로 61 101동 101호)'),
              ]),

              _section('주보호자', help: '평소 연락받는 보호자입니다.', children: [
                _label('성함'),
                _field(_parentName, '예: 김영희'),
                _label('관계'),
                _choices(_relationOptions(_parentRelation), _parentRelation, (v) => _parentRelation = v),
                _label('연락처'),
                _field(_parentPhone, '010-0000-0000', keyboard: TextInputType.phone),
              ]),

              _section('비상연락망', help: '주보호자가 전화를 받지 못할 때 선생님이 연락할 분입니다. 주보호자와 다른 번호를 입력해 주세요.', children: [
                _label('성함'),
                _field(_parent2Name, '예: 김철수'),
                _label('관계'),
                _choices(_relationOptions(_parent2Relation), _parent2Relation, (v) => _parent2Relation = v),
                _label('연락처'),
                _field(_parent2Phone, '010-0000-0000', keyboard: TextInputType.phone),
              ]),

              _section('건강·전달사항', children: [
                _label('알레르기'),
                _field(_allergies, '예: 땅콩, 복숭아 (없으면 "없음")'),
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton(
                    onPressed: () => setState(() => _allergies.text = '없음'),
                    style: TextButton.styleFrom(minimumSize: const Size(48, 40)),
                    child: const Text('알레르기 없음', style: TextStyle(fontSize: 14)),
                  ),
                ),
                _label('선생님께 전할 말', required: false),
                _field(_note, '예: 차멀미가 있어요, 앞자리에 앉혀 주세요', maxLines: 3),
              ]),

              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(_error!, style: const TextStyle(color: Color(0xFFDC2626), fontSize: 14, fontWeight: FontWeight.w700)),
                ),

              SizedBox(
                height: 56,
                child: ElevatedButton(
                  onPressed: _saving ? null : _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2563EB),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: _saving
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('저장하기', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
