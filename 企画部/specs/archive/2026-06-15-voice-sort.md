# 音メモ仕分け（VoiceSort）

## 概要
スマホで録った雑な音声メモを文字化し、Claudeが「日報の素材／note案／タスク」の3つに自動仕分けして、それぞれの宛先用に整える。

## MVP機能
- Web Speech APIで音声→文字
- Claudeが内容を「日報／note／タスク」に分類＋宛先別に整形
- 仕分け結果をコピー（日報はObsidian貼り付け前提の体裁）

## 技術スタック
- Vanilla JS / localStorage / Web Speech API・Claude API

## 難度
**低（1〜2h）**

## 独自性
「KoeNaoshi（声→整文）に似ているが、1本の音声を“どこに使うか”まで仕分けて複数宛先に振り分ける点が違う」

## 20年後の視点
2045年、思考は喋った瞬間に正しい場所へ流れる。手で仕分ける作業自体が消えている。

## 備考
trend反映: voice agent（Wispr Flow）。声→文字は既存案と被るので「仕分け」を主役にする。
