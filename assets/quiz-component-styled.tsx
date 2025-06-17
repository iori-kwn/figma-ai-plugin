import React from 'react';

function QuizCard({ children }: React.PropsWithChildren<{}>) {
  return <div className="bg-white border-2 border-black rounded-none shadow-none max-w-sm mx-auto">{children}</div>;
}

function QuizHeader({ title, progress }: { title: string; progress: string }) {
  return (
    <div className="flex justify-between items-center p-4 border-b-2 border-black">
      <h1 className="text-lg font-bold text-black">{title}</h1>
      <span className="text-sm text-black font-medium">{progress}</span>
    </div>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <div className="px-4 py-2">
      <div className="w-full h-2 bg-gray-200 border border-black">
        <div className="h-full bg-black transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
      <p className="text-xs text-black mt-1 font-medium">進捗: {percentage}%</p>
    </div>
  );
}

function QuestionSection({ questionType, question }: { questionType: string; question: string }) {
  return (
    <div className="p-4 bg-white border-b-2 border-black">
      <p className="text-xs text-black font-medium mb-2">{questionType}</p>
      <h2 className="text-base font-bold text-black leading-tight">{question}</h2>
    </div>
  );
}

function RadioOption({
  text,
  isSelected = false,
  isCorrect = false,
  showResult = false,
}: {
  text: string;
  isSelected?: boolean;
  isCorrect?: boolean;
  showResult?: boolean;
}) {
  const getOptionStyles = () => {
    if (showResult && isCorrect) {
      return 'bg-white border-2 border-black text-black font-medium';
    }
    if (isSelected && !showResult) {
      return 'bg-black border-2 border-black text-white font-medium';
    }
    return 'bg-white border-2 border-black text-black hover:bg-gray-50';
  };

  return (
    <div className={`p-4 mb-2 mx-4 cursor-pointer transition-colors ${getOptionStyles()}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{text}</span>
        <div className="w-4 h-4 border-2 border-black bg-white relative">
          {(isSelected || (showResult && isCorrect)) && <div className="w-2 h-2 bg-black absolute top-0.5 left-0.5" />}
        </div>
        {showResult && isCorrect && <span className="text-black font-bold ml-2">✓</span>}
      </div>
    </div>
  );
}

function ActionButton({
  text,
  isPrimary = true,
  onClick,
}: {
  text: string;
  isPrimary?: boolean;
  onClick?: () => void;
}) {
  const buttonStyles = isPrimary
    ? 'bg-black text-white border-2 border-black'
    : 'bg-white text-black border-2 border-black hover:bg-gray-50';

  return (
    <button className={`w-full mx-4 mb-4 p-4 font-bold text-sm transition-colors ${buttonStyles}`} onClick={onClick}>
      {text}
    </button>
  );
}

function ResultsCard({ score, message }: { score: string; message: string }) {
  return (
    <QuizCard>
      <QuizHeader title="結果発表" progress="" />
      <ProgressBar percentage={100} />

      <div className="p-4 text-center border-b-2 border-black">
        <div className="text-3xl font-bold text-black mb-2">{score}</div>
        <p className="text-sm text-black font-medium">正解率: 100%</p>
      </div>

      <div className="p-4 bg-white border-b-2 border-black">
        <div className="border-2 border-black p-4 text-center">
          <p className="text-sm font-bold text-black mb-1">🎉 {message}</p>
          <p className="text-xs text-black font-medium">よく理解できています</p>
        </div>
      </div>

      <ActionButton text="🔄 もう一度挑戦する" isPrimary={true} />
      <ActionButton text="解説を見る" isPrimary={false} />
    </QuizCard>
  );
}

export default function StyledQuizComponent() {
  return (
    <div className="bg-gray-100 min-h-screen p-4 font-sans">
      {/* Question State */}
      <div className="mb-8">
        <QuizCard>
          <QuizHeader title="確認問題" progress="1 / 3" />
          <ProgressBar percentage={33} />
          <QuestionSection questionType="単一選択" question="ReactのuseStateフックの主な目的は何ですか？" />

          <div className="py-4">
            <RadioOption text="コンポーネントの状態を管理する" isSelected={true} />
            <RadioOption text="APIからデータを取得する" />
            <RadioOption text="イベントリスナーを設定する" />
            <RadioOption text="CSSスタイルを適用する" />
          </div>

          <ActionButton text="解答する" />
        </QuizCard>
      </div>

      {/* Answer Selected State */}
      <div className="mb-8">
        <QuizCard>
          <QuizHeader title="確認問題" progress="1 / 3" />
          <ProgressBar percentage={33} />
          <QuestionSection questionType="単一選択" question="ReactのuseStateフックの主な目的は何ですか？" />

          <div className="py-4">
            <RadioOption text="コンポーネントの状態を管理する" isSelected={true} isCorrect={true} showResult={true} />
            <RadioOption text="APIからデータを取得する" />
            <RadioOption text="イベントリスナーを設定する" />
            <RadioOption text="CSSスタイルを適用する" />
          </div>

          <ActionButton text="次の問題へ →" />
        </QuizCard>
      </div>

      {/* Results State */}
      <ResultsCard score="3/3" message="素晴らしい成績です！" />
    </div>
  );
}
