#!/usr/bin/env python3
"""
Deep Dive - AIコミュニケーション分析サーバー
起動方法: python3 server.py
アクセス: http://localhost:8765
"""

import json
import urllib.request
import urllib.error
import ssl
import os
import re
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 8765
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
HTML_FILE = os.path.join(BASE_DIR, 'index.html')

ANALYSIS_PROMPT = """ビジネスコミュニケーション分析の専門家として、以下の会議ログを分析してください。

背景: {context}
参加者: {participants}

会議ログ:
{meeting_log}

必ずJSONのみで回答（前後に説明文不要）:
{{"overall_score":75,"subscores":{{"clarity":80,"empathy":60,"persuasion":75,"listening":55,"constructiveness":70,"conciseness":85}},"gaps":[{{"situation":"場面の引用","speaker_intent":"話し手の意図","likely_reception":"相手の受け取り方","gap_type":"ズレの種類","severity":"high"}}],"strengths":["良い点"],"improvement_actions":[{{"priority":1,"title":"タイトル","description":"改善方法","example_phrase":"言い換え例","impact":"期待効果"}}],"next_meeting_checklist":["チェック項目"],"summary":"総合評価（2文以内）","detected_persons":[{{"name":"登場人物名","enough_data":true,"role":"役割や立場"}}]}}

ルール: gaps最大2件、actions最大3件、checklist最大4件、detected_persons最大5件（ログに登場した人物のみ、enough_dataは発言が3回以上ならtrue）、各テキストは60字以内、日本語で回答"""

PARTICIPANT_PROMPT = """ビジネスコミュニケーションの専門家として、以下の会議ログから「{name}」のコミュニケーション特性を分析してください。

{name}の役割: {role}
会議ログ:
{meeting_log}

必ずJSONのみで回答（前後に説明文不要）:
{{"communication_style":"コミュニケーションスタイルの特徴","decision_pattern":"意思決定の傾向","emotional_triggers":["反応しやすいポイント"],"effective_approach":"効果的なアプローチ方法","phrases_that_work":["刺さる言葉・フレーズ"],"phrases_to_avoid":["避けるべき言葉・アプローチ"],"summary":"この人物への総合的な攻略法（2文以内）"}}

ルール: 各リスト最大3件、各テキスト80字以内、日本語で回答"""

MEETING_PREP_PROMPT = """ビジネスコミュニケーションの専門家として、以下の会議の事前戦略を立案してください。

会議の目的: {goal}
議題・話したいこと: {agenda}
想定される懸念・反論: {concerns}
参加者プロフィール:
{profiles}

必ずJSONのみで回答（前後に説明文不要）:
{{"opening_strategy":"会議の入り方・アイスブレイク","key_messages":[{{"point":"伝えたいポイント","how_to_present":"伝え方","expected_reaction":"想定される反応"}}],"closing_strategy":"会議の締め方・次のアクション設定","risk_points":["注意すべきリスク・懸念点と対処法"],"checklist":["会議前に準備すること"],"summary":"この会議の攻略ポイント（2文以内）"}}

ルール: key_messages最大3件、risk_points最大4件（ユーザーが入力した懸念点を優先的に含める）、checklist最大4件、各テキスト80字以内、日本語で回答"""

MYPROFILE_PROMPT = """ビジネスコミュニケーションの専門家として、以下の分析実績データをもとに、このユーザーの「コミュニケーション総合プロフィール」を作成してください。

【分析実績サマリー】
分析回数: {n}回
平均スコア: {avg_score}点
スコア推移: {trend}
スコア変化: {score_delta}

【スキル別平均スコア】
{subscores_text}

【頻出する課題パターン（上位）】
{gap_patterns}

【繰り返し現れる強み】
{strengths}

【頻出の改善アクション】
{actions}

【コミュニケーションタイプ一覧】
必ず以下の6タイプから、データに最も合致する1つを選んでください。自由に作らないこと。
1. 論理構築型 / 🧠 … データ・根拠を重視し、論理的に話を組み立てる
2. 関係重視型 / 🤝 … 人間関係・共感を大切にし、場の空気を読む
3. 推進決断型 / ⚡ … スピードと結果を重視し、率直に意見を言う
4. 調和配慮型 / 🌿 … 対立を避け、全員の意見をまとめようとする
5. 慎重分析型 / 🔍 … リスクを見極め、慎重に判断する
6. 表現共有型 / 🌟 … 感情・ビジョンを言語化し、周囲を巻き込む

必ずJSONのみで回答（前後に説明文不要）:
{{"personality_type":"上記6タイプから1つ選んだタイプ名（例：論理構築型）","type_icon":"そのタイプの絵文字（上記リストの絵文字を使うこと）","type_description":"そのタイプの特徴（3文以内）","core_strengths":[{{"strength":"強みの名前","description":"具体的な説明","evidence":"分析データからの根拠"}}],"blind_spots":[{{"pattern":"陥りがちなパターン名","trigger":"こういう状況で出やすい","impact":"相手への影響","hint":"気づき方のヒント"}}],"growth_areas":[{{"area":"成長領域","current_score":60,"tip":"具体的な改善アクション"}}],"communication_mantra":"あなたの強みを活かすための一言（20字以内）","next_focus":"今すぐ取り組む最優先アクション（1つ）","overall_assessment":"総合的な評価コメント（3文以内）"}}

ルール: core_strengths最大3件、blind_spots最大3件、growth_areas最大3件、各テキスト80字以内、日本語で回答"""


class DeepDiveHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # 標準ログを非表示

    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            try:
                with open(HTML_FILE, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
            except FileNotFoundError:
                self.send_error(404, 'index.html not found')
        else:
            self.send_error(404, 'Not Found')

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception:
            self.send_json(400, {'error': 'リクエストの形式が不正です'})
            return

        handlers = {
            '/api/analyze': self._call_claude,
            '/api/participant': self._call_participant,
            '/api/meeting-prep': self._call_meeting_prep,
            '/api/myprofile': self._call_myprofile,
        }
        handler = handlers.get(self.path)
        if not handler:
            self.send_error(404, 'Not Found')
            return
        try:
            result = handler(data)
            self.send_json(200, result)
        except ValueError as e:
            self.send_json(400, {'error': str(e)})
        except Exception as e:
            self.send_json(500, {'error': f'サーバーエラー: {str(e)}'})

    def _extract_json(self, text):
        """ClaudeのレスポンスからJSONを抽出。途中切れでも最低限動くよう補修する。"""
        # コードブロック除去
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        text = text.strip()

        # まずそのままパース試行
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # { ... } を抽出して試行
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        # JSON途中切れの場合：最後の完全なフィールドまでで打ち切り補修
        chunk = match.group() if match else text
        # 開き括弧・配列を数えて閉じを補完
        opens = chunk.count('{') - chunk.count('}')
        arr_opens = chunk.count('[') - chunk.count(']')
        # 末尾の不完全なカンマ・キーを除去
        chunk = re.sub(r',\s*$', '', chunk.rstrip())
        chunk = re.sub(r',\s*"[^"]*"\s*:\s*[^,}\]]*$', '', chunk)
        chunk += ']' * max(0, arr_opens) + '}' * max(0, opens)
        try:
            return json.loads(chunk)
        except json.JSONDecodeError as e:
            raise ValueError(f'AIの返答をJSON解析できませんでした: {e}\n\n返答の先頭200字: {text[:200]}')

    def _call_claude(self, data):
        api_key = data.get('api_key', '').strip()
        meeting_log = data.get('meeting_log', '').strip()
        context = data.get('context', '特に指定なし').strip() or '特に指定なし'
        participants = data.get('participants', '特に指定なし').strip() or '特に指定なし'

        if not api_key:
            raise ValueError('APIキーが必要です。設定画面でAnthropicのAPIキーを入力してください。')
        if not meeting_log or len(meeting_log) < 20:
            raise ValueError('会議ログが短すぎます。もう少し詳しいログを入力してください。')

        prompt = ANALYSIS_PROMPT.format(
            context=context,
            participants=participants,
            meeting_log=meeting_log
        )

        return self._call_api(api_key, prompt)


    def _call_participant(self, data):
        api_key = data.get('api_key', '').strip()
        name = data.get('name', '').strip()
        role = data.get('role', '参加者').strip() or '参加者'
        meeting_log = data.get('meeting_log', '').strip()

        if not api_key:
            raise ValueError('APIキーが必要です')
        if not name:
            raise ValueError('参加者名が必要です')
        if not meeting_log:
            raise ValueError('会議ログが必要です')

        prompt = PARTICIPANT_PROMPT.format(name=name, role=role, meeting_log=meeting_log)
        return self._call_api(api_key, prompt)

    def _call_meeting_prep(self, data):
        api_key = data.get('api_key', '').strip()
        goal = data.get('goal', '').strip()
        agenda = data.get('agenda', '').strip()
        concerns = data.get('concerns', '').strip()
        profiles = data.get('profiles', [])

        if not api_key:
            raise ValueError('APIキーが必要です')
        if not goal:
            raise ValueError('会議の目的を入力してください')

        profiles_text = '\n'.join([
            f"【{p['name']}】{p.get('role','')} - スタイル: {p.get('communication_style','不明')} / アプローチ: {p.get('effective_approach','')}"
            for p in profiles
        ]) if profiles else '（プロフィールなし）'

        prompt = MEETING_PREP_PROMPT.format(
            goal=goal,
            agenda=agenda or '未定',
            concerns=concerns or '（特に指定なし）',
            profiles=profiles_text
        )
        return self._call_api(api_key, prompt)

    def _call_myprofile(self, data):
        api_key = data.get('api_key', '').strip()
        history = data.get('history', [])

        if not api_key:
            raise ValueError('APIキーが必要です')
        if len(history) < 2:
            raise ValueError('プロフィール生成には2回以上の分析が必要です')

        # 集計
        scores = [h.get('score', 0) for h in history]
        avg = round(sum(scores) / len(scores))
        trend = ' → '.join(str(s) for s in scores[-5:])
        delta = scores[0] - scores[-1]
        delta_str = f'+{delta}ポイント向上' if delta > 0 else f'{delta}ポイント低下' if delta < 0 else '変化なし'

        # サブスコア平均
        sub_keys = ['clarity','empathy','persuasion','listening','constructiveness','conciseness']
        sub_names = {'clarity':'明確さ','empathy':'共感力','persuasion':'説得力','listening':'傾聴力','constructiveness':'建設性','conciseness':'簡潔さ'}
        sub_avgs = {}
        for k in sub_keys:
            vals = [h.get('data',{}).get('subscores',{}).get(k,0) for h in history if h.get('data',{}).get('subscores')]
            sub_avgs[k] = round(sum(vals)/len(vals)) if vals else 0
        subscores_text = '\n'.join(f'- {sub_names[k]}: {v}点' for k,v in sub_avgs.items())

        # 頻出パターン集計
        from collections import Counter
        gap_types = Counter()
        strengths_list = []
        action_titles = Counter()
        for h in history:
            d = h.get('data', {})
            for g in d.get('gaps', []):
                if g.get('gap_type'): gap_types[g['gap_type']] += 1
            strengths_list += d.get('strengths', [])
            for a in d.get('improvement_actions', []):
                if a.get('title'): action_titles[a['title']] += 1

        gap_patterns = '\n'.join(f'- {t}（{c}回）' for t,c in gap_types.most_common(4)) or '（データなし）'
        strengths_text = '\n'.join(f'- {s}' for s in strengths_list[:5]) or '（データなし）'
        actions_text = '\n'.join(f'- {t}（{c}回）' for t,c in action_titles.most_common(4)) or '（データなし）'

        prompt = MYPROFILE_PROMPT.format(
            n=len(history), avg_score=avg, trend=trend, score_delta=delta_str,
            subscores_text=subscores_text, gap_patterns=gap_patterns,
            strengths=strengths_text, actions=actions_text
        )
        return self._call_api(api_key, prompt)

    def _call_api(self, api_key, prompt):
        """Claude APIを呼び出す共通メソッド"""
        payload = json.dumps({
            'model': 'claude-opus-4-6',
            'max_tokens': 1500,
            'messages': [{'role': 'user', 'content': prompt}]
        }).encode('utf-8')

        ctx = ssl.create_default_context()
        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=payload,
            headers={
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            method='POST'
        )
        try:
            with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
                api_result = json.loads(resp.read())
                text = api_result['content'][0]['text']
                analysis = self._extract_json(text)
                return {'success': True, 'data': analysis}
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')
            try:
                msg = json.loads(body).get('error', {}).get('message', body[:200])
            except Exception:
                msg = body[:200]
            if e.code == 401:
                raise ValueError('APIキーが無効です')
            if e.code == 429:
                raise ValueError('API利用制限に達しました。しばらくしてから再試行してください。')
            raise ValueError(f'APIエラー ({e.code}): {msg}')


if __name__ == '__main__':
    server = HTTPServer(('localhost', PORT), DeepDiveHandler)
    print('=' * 55)
    print('  🚀 Deep Dive サーバーが起動しました')
    print(f'  👉 ブラウザで開く: http://localhost:{PORT}')
    print('  ⏹  停止するには Ctrl+C を押してください')
    print('=' * 55)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nサーバーを停止しました。')
        server.server_close()
