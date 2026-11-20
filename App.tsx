import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Info,
  X,
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trophy,
} from 'lucide-react'

// ==================== TYPES & CONSTANTS ====================

type SymbolId =
  | 'palayok'
  | 'sun'
  | 'mango'
  | 'coin'
  | 'gumamela'
  | 'bell'
  | 'wild'
  | 'scatter'

interface SymbolDef {
  id: SymbolId
  emoji: string
  name: string
  color: string
  weight: number // higher = more common
}

const SYMBOLS: SymbolDef[] = [
  { id: 'palayok', emoji: '🏺', name: 'Golden Palayok', color: '#f59e0b', weight: 8 },
  { id: 'sun', emoji: '☀️', name: 'Golden Sun', color: '#fbbf24', weight: 12 },
  { id: 'mango', emoji: '🥭', name: 'Mango', color: '#f97316', weight: 18 },
  { id: 'coin', emoji: '🪙', name: 'Golden Coin', color: '#eab308', weight: 16 },
  { id: 'gumamela', emoji: '🌺', name: 'Gumamela', color: '#ec4899', weight: 20 },
  { id: 'bell', emoji: '🔔', name: 'Fiesta Bell', color: '#a855f7', weight: 14 },
  { id: 'wild', emoji: '⭐', name: 'Wild', color: '#22c55e', weight: 6 },
  { id: 'scatter', emoji: '🎁', name: 'Scatter', color: '#ef4444', weight: 5 },
]

const PAYTABLE: Record<SymbolId, { 3: number; 4: number; 5: number }> = {
  palayok: { 3: 15, 4: 50, 5: 200 },
  sun: { 3: 10, 4: 30, 5: 100 },
  mango: { 3: 6, 4: 18, 5: 60 },
  coin: { 3: 8, 4: 25, 5: 80 },
  gumamela: { 3: 5, 4: 15, 5: 50 },
  bell: { 3: 7, 4: 20, 5: 70 },
  wild: { 3: 20, 4: 60, 5: 250 },
  scatter: { 3: 0, 4: 0, 5: 0 }, // scatters pay free spins, not line wins
}

// 20 paylines (row indices 0=top, 1=mid, 2=bottom)
const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // middle
  [0, 0, 0, 0, 0], // top
  [2, 2, 2, 2, 2], // bottom
  [0, 1, 2, 1, 0], // V
  [2, 1, 0, 1, 2], // ^
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [1, 1, 0, 1, 1],
  [1, 1, 2, 1, 1],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 0, 2, 0, 0],
]

const BET_OPTIONS = [1, 2, 5, 10, 25, 50, 100]
const STARTING_BALANCE = 10000
const FREE_SPINS_AWARD = 10
const JACKPOT_CHANCE = 0.0008 // ~0.08% per spin
const MAX_JACKPOT_MULT = 5000

const STORAGE_KEY = 'mega-palayok-5000x-save'

// ==================== HELPERS ====================

function weightedRandomSymbol(excludeScatter = false): SymbolId {
  const pool = excludeScatter ? SYMBOLS.filter((s) => s.id !== 'scatter') : SYMBOLS
  const total = pool.reduce((sum, s) => sum + s.weight, 0)
  let r = Math.random() * total
  for (const s of pool) {
    r -= s.weight
    if (r <= 0) return s.id
  }
  return pool[0].id
}

function generateReel(): SymbolId[] {
  // 3 visible + buffer symbols for animation
  return Array.from({ length: 20 }, () => weightedRandomSymbol())
}

function getSymbol(id: SymbolId): SymbolDef {
  return SYMBOLS.find((s) => s.id === id)!
}

function formatCoins(n: number): string {
  return Math.floor(n).toLocaleString()
}

// ==================== AUDIO (Web Audio API - no external files) ====================

class SoundManager {
  private ctx: AudioContext | null = null
  private enabled = true

  setEnabled(v: boolean) {
    this.enabled = v
  }

  private getCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return this.ctx
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15) {
    if (!this.enabled) return
    try {
      const ctx = this.getCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + duration)
    } catch {
      // ignore
    }
  }

  spin() {
    this.tone(220, 0.08, 'square', 0.08)
    setTimeout(() => this.tone(180, 0.1, 'square', 0.06), 80)
  }

  reelStop() {
    this.tone(440, 0.06, 'triangle', 0.1)
  }

  win(small = true) {
    if (small) {
      this.tone(523, 0.1, 'sine', 0.12)
      setTimeout(() => this.tone(659, 0.12, 'sine', 0.12), 100)
      setTimeout(() => this.tone(784, 0.15, 'sine', 0.1), 200)
    } else {
      this.tone(523, 0.12, 'sine', 0.15)
      setTimeout(() => this.tone(659, 0.12, 'sine', 0.15), 120)
      setTimeout(() => this.tone(784, 0.12, 'sine', 0.15), 240)
      setTimeout(() => this.tone(1046, 0.25, 'sine', 0.18), 360)
    }
  }

  freeSpins() {
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.tone(400 + i * 80, 0.15, 'sine', 0.12), i * 100)
    }
  }

  jackpot() {
    for (let i = 0; i < 12; i++) {
      setTimeout(() => this.tone(300 + i * 60, 0.2, 'sawtooth', 0.1), i * 80)
    }
  }

  click() {
    this.tone(600, 0.04, 'square', 0.06)
  }
}

const sound = new SoundManager()

// ==================== GAME LOGIC ====================

interface WinResult {
  lineIndex: number
  symbol: SymbolId
  count: number
  payout: number
  positions: { reel: number; row: number }[]
}

function evaluateGrid(grid: SymbolId[][], bet: number): {
  wins: WinResult[]
  totalPayout: number
  scatterCount: number
} {
  const wins: WinResult[] = []
  let totalPayout = 0
  let scatterCount = 0

  // Count scatters (anywhere)
  for (let r = 0; r < 5; r++) {
    for (let row = 0; row < 3; row++) {
      if (grid[r][row] === 'scatter') scatterCount++
    }
  }

  // Evaluate each payline
  for (let li = 0; li < PAYLINES.length; li++) {
    const line = PAYLINES[li]
    const symbolsOnLine: SymbolId[] = line.map((row, reel) => grid[reel][row])

    // Determine the paying symbol (first non-wild, or wild if all wild)
    let paySymbol: SymbolId | null = null
    for (const s of symbolsOnLine) {
      if (s !== 'wild' && s !== 'scatter') {
        paySymbol = s
        break
      }
    }
    if (!paySymbol) {
      // all wilds / scatters – treat as wild
      if (symbolsOnLine.every((s) => s === 'wild' || s === 'scatter')) {
        paySymbol = 'wild'
      } else {
        continue
      }
    }

    // Count consecutive matching from left (wild substitutes)
    let count = 0
    const positions: { reel: number; row: number }[] = []
    for (let i = 0; i < 5; i++) {
      const s = symbolsOnLine[i]
      if (s === paySymbol || s === 'wild') {
        count++
        positions.push({ reel: i, row: line[i] })
      } else {
        break
      }
    }

    if (count >= 3) {
      const mult = PAYTABLE[paySymbol][count as 3 | 4 | 5] || 0
      if (mult > 0) {
        const payout = mult * bet
        wins.push({ lineIndex: li, symbol: paySymbol, count, payout, positions })
        totalPayout += payout
      }
    }
  }

  return { wins, totalPayout, scatterCount }
}

// ==================== COMPONENTS ====================

function SymbolDisplay({
  id,
  size = 'md',
  glowing = false,
}: {
  id: SymbolId
  size?: 'sm' | 'md' | 'lg'
  glowing?: boolean
}) {
  const s = getSymbol(id)
  const sizeClass =
    size === 'sm' ? 'text-2xl' : size === 'lg' ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl'
  return (
    <div
      className={`flex items-center justify-center select-none ${sizeClass} ${
        glowing ? 'symbol-win' : ''
      }`}
      style={{ filter: glowing ? undefined : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
      title={s.name}
    >
      {s.emoji}
    </div>
  )
}

function ParticleBurst({ active }: { active: boolean }) {
  const particles = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      tx: (Math.random() - 0.5) * 600,
      ty: (Math.random() - 0.5) * 600 - 100,
      emoji: ['✨', '⭐', '🪙', '🎉', '🏺'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 0.3,
    }))
  }, [active])

  if (!active) return null
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle text-2xl absolute left-1/2 top-1/2"
          style={
            {
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              animationDelay: `${p.delay}s`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </div>
      ))}
    </div>
  )
}

function JackpotOverlay({
  show,
  amount,
  onClose,
}: {
  show: boolean
  amount: number
  onClose: () => void
}) {
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="text-center animate-bounce-soft px-4">
        <div className="text-6xl md:text-8xl mb-4 jackpot-explosion">🏺</div>
        <h2 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 drop-shadow-lg">
          MEGA JACKPOT!
        </h2>
        <p className="text-2xl md:text-4xl text-yellow-300 mt-4 font-bold">
          +{formatCoins(amount)} COINS
        </p>
        <p className="text-amber-200/80 mt-2 text-sm md:text-base">5000x VIRTUAL MULTIPLIER!</p>
        <button
          onClick={onClose}
          className="mt-8 px-8 py-3 bg-gradient-to-r from-amber-500 to-orange-600 rounded-full font-bold text-lg shadow-lg hover:brightness-110 transition"
        >
          AWESOME!
        </button>
      </div>
    </div>
  )
}

function FreeSpinsOverlay({
  show,
  count,
  onClose,
}: {
  show: boolean
  count: number
  onClose: () => void
}) {
  if (!show) return null
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="free-spins-banner bg-gradient-to-br from-amber-600 via-orange-600 to-red-700 rounded-2xl p-8 md:p-12 text-center shadow-2xl border-4 border-yellow-400 max-w-md mx-4">
        <div className="text-5xl mb-4 animate-float">🎁🎁🎁</div>
        <h2 className="text-3xl md:text-4xl font-black text-yellow-100">FREE SPINS!</h2>
        <p className="text-5xl font-black text-white mt-4">{count}</p>
        <p className="text-amber-100 mt-2">FREE SPINS AWARDED</p>
        <button
          onClick={onClose}
          className="mt-6 px-8 py-3 bg-yellow-400 text-amber-900 rounded-full font-bold text-lg hover:bg-yellow-300 transition shadow-lg"
        >
          START FREE SPINS
        </button>
      </div>
    </div>
  )
}

function BigWinOverlay({
  show,
  amount,
  onClose,
}: {
  show: boolean
  amount: number
  onClose: () => void
}) {
  if (!show) return null
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div className="big-win-overlay text-center px-4">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-amber-500">
          BIG WIN!
        </h2>
        <p className="text-3xl md:text-4xl text-yellow-300 font-bold mt-2">
          +{formatCoins(amount)}
        </p>
      </div>
    </div>
  )
}

function RulesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
      <div className="bg-gradient-to-b from-amber-950 to-stone-950 w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto border border-amber-700/50 shadow-2xl">
        <div className="sticky top-0 bg-amber-950/95 backdrop-blur flex items-center justify-between p-4 border-b border-amber-800">
          <h2 className="text-xl font-bold text-amber-200 flex items-center gap-2">
            <Info size={20} /> Game Rules & Paytable
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-amber-900/50 rounded-full">
            <X size={22} />
          </button>
        </div>
        <div className="p-4 space-y-5 text-sm">
          <section>
            <h3 className="font-bold text-amber-300 mb-2">How to Play</h3>
            <ul className="list-disc list-inside space-y-1 text-amber-100/90">
              <li>Choose your bet amount using + / − buttons</li>
              <li>Press SPIN to start the reels</li>
              <li>Match 3+ identical symbols on a payline from left to right</li>
              <li>⭐ Wild substitutes for any symbol except Scatter</li>
              <li>🎁 3+ Scatters award 10 Free Spins</li>
              <li>Random MEGA JACKPOT can hit up to 5000× your bet</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">Paytable (× Bet)</h3>
            <div className="grid gap-2">
              {SYMBOLS.filter((s) => s.id !== 'scatter').map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 bg-black/30 rounded-lg px-3 py-2"
                >
                  <span className="text-2xl w-10 text-center">{s.emoji}</span>
                  <div className="flex-1">
                    <div className="font-medium text-amber-100">{s.name}</div>
                    <div className="text-xs text-amber-200/70">
                      3× = {PAYTABLE[s.id][3]} &nbsp;|&nbsp; 4× = {PAYTABLE[s.id][4]}{' '}
                      &nbsp;|&nbsp; 5× = {PAYTABLE[s.id][5]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-bold text-amber-300 mb-2">Symbols</h3>
            <div className="flex flex-wrap gap-3">
              {SYMBOLS.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col items-center bg-black/30 rounded-lg p-2 w-20"
                >
                  <span className="text-3xl">{s.emoji}</span>
                  <span className="text-[10px] text-center text-amber-200/80 mt-1 leading-tight">
                    {s.name}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-red-950/40 border border-red-800/50 rounded-lg p-3">
            <p className="text-red-200 text-xs leading-relaxed">
              <strong>Entertainment Only.</strong> This is a single-player virtual coin game. No
              real money, deposits, withdrawals, or cash prizes. All coins are fictional and for
              fun.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

// ==================== MAIN APP ====================

export default function App() {
  // Core state
  const [balance, setBalance] = useState(STARTING_BALANCE)
  const [bet, setBet] = useState(10)
  const [lastWin, setLastWin] = useState(0)
  const [totalSpins, setTotalSpins] = useState(0)
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0)
  const [isFreeSpinMode, setIsFreeSpinMode] = useState(false)

  // Reels: 5 reels × 3 rows of SymbolId
  const [grid, setGrid] = useState<SymbolId[][]>(() =>
    Array.from({ length: 5 }, () =>
      Array.from({ length: 3 }, () => weightedRandomSymbol())
    )
  )
  const [spinning, setSpinning] = useState(false)
  const [reelSpinning, setReelSpinning] = useState([false, false, false, false, false])
  const [winningPositions, setWinningPositions] = useState<Set<string>>(new Set())
  const [autoSpin, setAutoSpin] = useState(false)

  // UI overlays
  const [showRules, setShowRules] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [showJackpot, setShowJackpot] = useState(false)
  const [jackpotAmount, setJackpotAmount] = useState(0)
  const [showFreeSpins, setShowFreeSpins] = useState(false)
  const [pendingFreeSpins, setPendingFreeSpins] = useState(0)
  const [showBigWin, setShowBigWin] = useState(false)
  const [bigWinAmount, setBigWinAmount] = useState(0)
  const [particleBurst, setParticleBurst] = useState(false)
  const [message, setMessage] = useState('Welcome to MEGA PALAYOK 5000X!')

  const autoSpinRef = useRef(false)
  const spinningRef = useRef(false)

  // Load save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const data = JSON.parse(raw)
        if (typeof data.balance === 'number') setBalance(data.balance)
        if (typeof data.bet === 'number' && BET_OPTIONS.includes(data.bet)) setBet(data.bet)
        if (typeof data.totalSpins === 'number') setTotalSpins(data.totalSpins)
      }
    } catch {
      // ignore
    }
  }, [])

  // Save
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ balance, bet, totalSpins })
      )
    } catch {
      // ignore
    }
  }, [balance, bet, totalSpins])

  useEffect(() => {
    sound.setEnabled(soundOn)
  }, [soundOn])

  useEffect(() => {
    autoSpinRef.current = autoSpin
  }, [autoSpin])

  const changeBet = (dir: 1 | -1) => {
    if (spinning || isFreeSpinMode) return
    sound.click()
    const idx = BET_OPTIONS.indexOf(bet)
    const next = BET_OPTIONS[Math.max(0, Math.min(BET_OPTIONS.length - 1, idx + dir))]
    setBet(next)
  }

  const resetGame = () => {
    if (spinning) return
    sound.click()
    setBalance(STARTING_BALANCE)
    setBet(10)
    setLastWin(0)
    setTotalSpins(0)
    setFreeSpinsLeft(0)
    setIsFreeSpinMode(false)
    setAutoSpin(false)
    setWinningPositions(new Set())
    setMessage('Game reset! Good luck!')
    localStorage.removeItem(STORAGE_KEY)
  }

  const doSpin = useCallback(async () => {
    if (spinningRef.current) return

    const currentBet = bet
    const inFree = freeSpinsLeft > 0 || isFreeSpinMode

    if (!inFree && balance < currentBet) {
      setMessage('Not enough coins! Lower your bet or Reset Game.')
      setAutoSpin(false)
      return
    }

    spinningRef.current = true
    setSpinning(true)
    setWinningPositions(new Set())
    setLastWin(0)
    setShowBigWin(false)
    setParticleBurst(false)

    if (!inFree) {
      setBalance((b) => b - currentBet)
    } else {
      setFreeSpinsLeft((f) => Math.max(0, f - 1))
    }

    setTotalSpins((t) => t + 1)
    sound.spin()
    setMessage(inFree ? `Free Spin! (${freeSpinsLeft} left)` : 'Spinning...')

    // Start all reels spinning
    setReelSpinning([true, true, true, true, true])

    // Generate final grid
    const finalGrid: SymbolId[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 3 }, () => weightedRandomSymbol())
    )

    // Stop reels one by one
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300 + i * 180))
      setGrid((prev) => {
        const next = prev.map((col) => [...col])
        next[i] = finalGrid[i]
        return next
      })
      setReelSpinning((prev) => {
        const n = [...prev]
        n[i] = false
        return n
      })
      sound.reelStop()
    }

    // Evaluate
    const { wins, totalPayout, scatterCount } = evaluateGrid(finalGrid, currentBet)

    // Random jackpot (only on paid spins, very rare)
    let jackpotWin = 0
    if (!inFree && Math.random() < JACKPOT_CHANCE) {
      jackpotWin = currentBet * MAX_JACKPOT_MULT
    }

    const totalWin = totalPayout + jackpotWin

    if (totalWin > 0) {
      setBalance((b) => b + totalWin)
      setLastWin(totalWin)

      const posSet = new Set<string>()
      wins.forEach((w) => w.positions.forEach((p) => posSet.add(`${p.reel}-${p.row}`)))
      setWinningPositions(posSet)

      if (jackpotWin > 0) {
        setJackpotAmount(jackpotWin)
        setShowJackpot(true)
        sound.jackpot()
        setParticleBurst(true)
        setMessage(`🏺 MEGA JACKPOT! +${formatCoins(jackpotWin)}`)
      } else if (totalPayout >= currentBet * 20) {
        setBigWinAmount(totalPayout)
        setShowBigWin(true)
        sound.win(false)
        setParticleBurst(true)
        setMessage(`🎉 BIG WIN! +${formatCoins(totalPayout)}`)
        setTimeout(() => setShowBigWin(false), 2500)
      } else {
        sound.win(true)
        setMessage(`You won ${formatCoins(totalPayout)} coins!`)
      }
    } else {
      setMessage(inFree ? 'No win this free spin' : 'Try again!')
    }

    // Scatter free spins
    if (scatterCount >= 3) {
      const awarded = FREE_SPINS_AWARD
      setPendingFreeSpins(awarded)
      setShowFreeSpins(true)
      sound.freeSpins()
      setIsFreeSpinMode(true)
      setFreeSpinsLeft((f) => f + awarded)
      setAutoSpin(false)
    }

    spinningRef.current = false
    setSpinning(false)

    // Continue auto or free spins
    setTimeout(() => {
      if (autoSpinRef.current && !spinningRef.current) {
        doSpin()
      } else if (freeSpinsLeft > 1 || (isFreeSpinMode && freeSpinsLeft > 0)) {
        // free spins continue automatically after short delay
        // handled by effect below
      }
    }, 800)
  }, [balance, bet, freeSpinsLeft, isFreeSpinMode])

  // Auto-continue free spins
  useEffect(() => {
    if (!spinning && isFreeSpinMode && freeSpinsLeft > 0 && !showFreeSpins && !showJackpot) {
      const t = setTimeout(() => {
        if (!spinningRef.current) doSpin()
      }, 1200)
      return () => clearTimeout(t)
    }
    if (isFreeSpinMode && freeSpinsLeft === 0 && !spinning) {
      setIsFreeSpinMode(false)
      setMessage('Free Spins complete!')
    }
  }, [spinning, isFreeSpinMode, freeSpinsLeft, showFreeSpins, showJackpot, doSpin])

  // Auto spin loop
  useEffect(() => {
    if (autoSpin && !spinning && !isFreeSpinMode && freeSpinsLeft === 0) {
      const t = setTimeout(() => {
        if (autoSpinRef.current && !spinningRef.current) doSpin()
      }, 900)
      return () => clearTimeout(t)
    }
  }, [autoSpin, spinning, isFreeSpinMode, freeSpinsLeft, doSpin])

  const handleSpinClick = () => {
    if (spinning) return
    if (autoSpin) {
      setAutoSpin(false)
      return
    }
    doSpin()
  }

  const toggleAuto = () => {
    if (spinning || isFreeSpinMode) return
    sound.click()
    setAutoSpin((a) => !a)
  }

  return (
    <div className="min-h-screen fiesta-bg flex flex-col items-center safe-bottom relative overflow-x-hidden">
      {/* Decorative top banner */}
      <div className="w-full bg-gradient-to-r from-amber-900 via-red-900 to-amber-900 py-2 px-4 text-center border-b border-amber-700/50">
        <h1 className="text-lg md:text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-200">
          🏺 MEGA PALAYOK 5000X – FUN EDITION 🏺
        </h1>
        <p className="text-[10px] md:text-xs text-amber-200/60 mt-0.5">
          Virtual Coins Only • Entertainment • No Real Money
        </p>
      </div>

      {/* Stats bar */}
      <div className="w-full max-w-3xl px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-black/40 rounded-xl px-3 py-2 border border-amber-800/40">
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Balance</div>
          <div className="text-lg md:text-xl font-bold text-yellow-300 tabular-nums">
            {formatCoins(balance)}
          </div>
        </div>
        <div className="bg-black/40 rounded-xl px-3 py-2 border border-amber-800/40">
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Bet</div>
          <div className="text-lg md:text-xl font-bold text-amber-200 tabular-nums">
            {formatCoins(bet)}
          </div>
        </div>
        <div className="bg-black/40 rounded-xl px-3 py-2 border border-amber-800/40">
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Last Win</div>
          <div className="text-lg md:text-xl font-bold text-green-400 tabular-nums">
            {formatCoins(lastWin)}
          </div>
        </div>
        <div className="bg-black/40 rounded-xl px-3 py-2 border border-amber-800/40">
          <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Spins</div>
          <div className="text-lg md:text-xl font-bold text-amber-100 tabular-nums">
            {totalSpins}
          </div>
        </div>
      </div>

      {/* Free spins indicator */}
      {(isFreeSpinMode || freeSpinsLeft > 0) && (
        <div className="w-full max-w-3xl px-3 mb-1">
          <div className="bg-gradient-to-r from-orange-700 to-amber-600 rounded-lg py-1.5 px-4 text-center font-bold text-white shadow-lg animate-pulse">
            🎁 FREE SPINS: {freeSpinsLeft} remaining
          </div>
        </div>
      )}

      {/* Message */}
      <div className="w-full max-w-3xl px-3 mb-2">
        <div className="bg-black/50 rounded-lg py-1.5 px-3 text-center text-sm text-amber-100/90 min-h-[2rem]">
          {message}
        </div>
      </div>

      {/* Slot machine frame */}
      <div className="relative w-full max-w-3xl px-2 sm:px-4 mb-3">
        {/* Decorative top of machine */}
        <div className="bg-gradient-to-b from-amber-700 to-amber-900 rounded-t-2xl border-4 border-amber-600 border-b-0 px-4 py-3 flex items-center justify-center gap-3 shadow-lg">
          <span className="text-3xl animate-float">🏺</span>
          <div className="text-center">
            <div className="text-amber-100 font-black text-sm md:text-base tracking-widest">
              PALAYOK FIESTA
            </div>
            <div className="text-[10px] text-amber-300/70">5 REELS • 20 PAYLINES</div>
          </div>
          <span className="text-3xl animate-float" style={{ animationDelay: '0.5s' }}>
            🏺
          </span>
        </div>

        {/* Reels container */}
        <div className="bg-gradient-to-b from-stone-900 to-black border-4 border-amber-600 border-t-0 rounded-b-2xl p-2 sm:p-3 shadow-2xl">
          <div className="grid grid-cols-5 gap-1 sm:gap-2 bg-gradient-to-b from-amber-950/80 to-stone-950 rounded-xl p-1.5 sm:p-2 border-2 border-amber-800/60">
            {grid.map((reel, reelIdx) => (
              <div
                key={reelIdx}
                className="relative bg-gradient-to-b from-stone-800 to-stone-950 rounded-lg overflow-hidden border border-amber-900/50 aspect-[1/2.4] sm:aspect-[1/2.2]"
              >
                <div
                  className={`h-full flex flex-col ${
                    reelSpinning[reelIdx] ? 'animate-pulse' : ''
                  }`}
                >
                  {reel.map((sym, rowIdx) => {
                    const isWin = winningPositions.has(`${reelIdx}-${rowIdx}`)
                    return (
                      <div
                        key={rowIdx}
                        className={`flex-1 flex items-center justify-center border-b border-amber-900/20 last:border-0 transition-all duration-300 ${
                          isWin ? 'bg-amber-500/20' : ''
                        } ${reelSpinning[reelIdx] ? 'opacity-60 blur-[1px]' : ''}`}
                      >
                        <SymbolDisplay
                          id={sym}
                          size="md"
                          glowing={isWin && !spinning}
                        />
                      </div>
                    )
                  })}
                </div>
                {/* Spinning overlay */}
                {reelSpinning[reelIdx] && (
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/10 to-transparent animate-pulse pointer-events-none" />
                )}
              </div>
            ))}
          </div>

          {/* Payline indicator dots */}
          <div className="flex justify-center gap-1 mt-2 opacity-50">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-3xl px-3 pb-6 space-y-3">
        {/* Bet controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => changeBet(-1)}
            disabled={spinning || isFreeSpinMode || bet === BET_OPTIONS[0]}
            className="btn-press w-12 h-12 rounded-full bg-amber-800 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center border-2 border-amber-600 shadow-lg"
          >
            <ChevronDown size={24} />
          </button>
          <div className="bg-black/50 rounded-xl px-6 py-2 border border-amber-700/50 min-w-[100px] text-center">
            <div className="text-[10px] text-amber-400/70 uppercase">Bet</div>
            <div className="text-xl font-bold text-yellow-300">{bet}</div>
          </div>
          <button
            onClick={() => changeBet(1)}
            disabled={spinning || isFreeSpinMode || bet === BET_OPTIONS[BET_OPTIONS.length - 1]}
            className="btn-press w-12 h-12 rounded-full bg-amber-800 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center border-2 border-amber-600 shadow-lg"
          >
            <ChevronUp size={24} />
          </button>
        </div>

        {/* Main buttons */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={toggleAuto}
            disabled={spinning || isFreeSpinMode}
            className={`btn-press flex items-center gap-2 px-4 py-3 rounded-xl font-bold border-2 shadow-lg transition disabled:opacity-40 ${
              autoSpin
                ? 'bg-red-700 border-red-500 text-white'
                : 'bg-stone-800 border-stone-600 text-amber-100 hover:bg-stone-700'
            }`}
          >
            {autoSpin ? <Pause size={18} /> : <Play size={18} />}
            {autoSpin ? 'STOP' : 'AUTO'}
          </button>

          <button
            onClick={handleSpinClick}
            disabled={spinning && !autoSpin}
            className={`btn-press relative px-10 sm:px-14 py-4 rounded-2xl font-black text-xl sm:text-2xl shadow-2xl border-4 transition-all ${
              spinning
                ? 'bg-amber-800 border-amber-600 text-amber-200 cursor-wait'
                : 'bg-gradient-to-b from-yellow-400 via-amber-500 to-orange-600 border-yellow-300 text-amber-950 hover:brightness-110 active:scale-95'
            }`}
          >
            {spinning ? (
              <span className="flex items-center gap-2">
                <Sparkles className="animate-spin" size={22} />
                SPINNING
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trophy size={22} />
                SPIN
              </span>
            )}
          </button>

          <button
            onClick={() => {
              sound.click()
              setShowRules(true)
            }}
            className="btn-press flex items-center gap-2 px-4 py-3 rounded-xl font-bold bg-stone-800 border-2 border-stone-600 text-amber-100 hover:bg-stone-700 shadow-lg"
          >
            <Info size={18} />
            RULES
          </button>
        </div>

        {/* Utility row */}
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            onClick={() => {
              setSoundOn((s) => !s)
              sound.click()
            }}
            className="btn-press p-2.5 rounded-full bg-black/40 border border-amber-800/50 hover:bg-amber-900/30"
            title={soundOn ? 'Mute' : 'Unmute'}
          >
            {soundOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          <button
            onClick={resetGame}
            disabled={spinning}
            className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-full text-sm bg-black/40 border border-amber-800/50 hover:bg-amber-900/30 disabled:opacity-40"
          >
            <RotateCcw size={16} />
            Reset Game
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto w-full py-3 text-center text-[10px] text-amber-200/40 px-4">
        MEGA PALAYOK 5000X – FUN EDITION • Personal entertainment project • Virtual coins only •
        No real-money gambling
      </footer>

      {/* Overlays */}
      <RulesModal open={showRules} onClose={() => setShowRules(false)} />
      <JackpotOverlay
        show={showJackpot}
        amount={jackpotAmount}
        onClose={() => {
          setShowJackpot(false)
          setParticleBurst(false)
        }}
      />
      <FreeSpinsOverlay
        show={showFreeSpins}
        count={pendingFreeSpins}
        onClose={() => setShowFreeSpins(false)}
      />
      <BigWinOverlay
        show={showBigWin}
        amount={bigWinAmount}
        onClose={() => setShowBigWin(false)}
      />
      <ParticleBurst active={particleBurst} />
    </div>
  )
}
