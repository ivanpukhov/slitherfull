import { FormEvent } from 'react'
import { formatNumber } from '../utils/helpers'
import { SKINS, SKIN_LABELS } from '../hooks/useGame'

interface NicknameScreenProps {
  visible: boolean
  nickname: string
  onNicknameChange: (value: string) => void
  selectedSkin: string
  onSelectSkin: (skin: string) => void
  skinName: string
  betValue: string
  onBetChange: (value: string) => void
  onBetBlur: () => void
  balance: number
  onStart: () => void
}

export function NicknameScreen({
  visible,
  nickname,
  onNicknameChange,
  selectedSkin,
  onSelectSkin,
  skinName,
  betValue,
  onBetChange,
  onBetBlur,
  balance,
  onStart
}: NicknameScreenProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onStart()
  }

  return (
    <div id="nicknameScreen" className={visible ? 'overlay' : 'overlay hidden'}>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <h2>Slither — онлайн арена</h2>
          <p>
            Выберите никнейм и скин, чтобы начать игру. На компьютере управляйте мышью и удерживайте её кнопку, чтобы
            ускориться. На смартфоне используйте виртуальный джойстик и кнопку ускорения.
          </p>
          <input
            id="nicknameInput"
            type="text"
            maxLength={16}
            placeholder="Ваш ник"
            autoComplete="off"
            value={nickname}
            onChange={(event) => onNicknameChange(event.target.value)}
          />
          <div className="skin-picker">
            <div className="caption">
              <span>Скины</span>
              <span id="skinName">{skinName}</span>
            </div>
            <div id="skinList" className="skin-list">
              {Object.entries(SKINS).map(([skin, colors]) => (
                <button
                  type="button"
                  key={skin}
                  className={`skin-option${skin === selectedSkin ? ' selected' : ''}`}
                  data-skin={skin}
                  data-name={SKIN_LABELS[skin] || skin}
                  style={{ background: colors[0] ?? '#94a3b8', backgroundImage: 'none' }}
                  onClick={() => onSelectSkin(skin)}
                  aria-label={SKIN_LABELS[skin] || skin}
                >
                </button>
              ))}
            </div>
          </div>
          <div className="bet-control">
            <label htmlFor="betInput">Ставка перед стартом</label>
            <input
              id="betInput"
              type="number"
              min={1}
              step={1}
              value={betValue}
              onChange={(event) => onBetChange(event.target.value)}
              onBlur={onBetBlur}
            />
            <div className="bet-hint">
              Доступно: <span id="betBalanceDisplay">{formatNumber(balance)}</span>
            </div>
          </div>
          <button id="startBtn" className="primary" type="submit">
            Играть
          </button>
        </form>
      </div>
    </div>
  )
}
