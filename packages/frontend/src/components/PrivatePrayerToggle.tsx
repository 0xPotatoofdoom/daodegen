'use client'

import { useState, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { QRCodeSVG } from 'qrcode.react'

/**
 * PrivatePrayerToggle — switch between standard and anonymous prayer modes.
 *
 * Standard prayer: wallet address is linked to the prayer and sermon.
 * Private prayer:  Self Protocol ZK proof — prove burn eligibility without
 *                  exposing wallet identity. Your spiritual questions deserve privacy.
 *
 * When private mode is active, the component displays a Self Protocol QR code.
 * The user scans it with the Self mobile app to generate a ZK proof that
 * authenticates their prayer without revealing their wallet address.
 */

type PrayerMode = 'standard' | 'private'

interface PrivatePrayerToggleProps {
  onModeChange?: (mode: PrayerMode) => void
  onProofGenerated?: (proof: SelfProofData) => void
}

export interface SelfProofData {
  attestationId: number
  proof: {
    a: [string, string]
    b: [[string, string], [string, string]]
    c: [string, string]
  }
  publicSignals: string[]
  userContextData?: string
}

const SELF_SCOPE = 'daodegen-anonymous-prayer'

function buildSelfUniversalLink(userId: string): string {
  const endpoint =
    typeof window !== 'undefined'
      ? `${window.location.origin}/v1/sermon/anonymous/callback`
      : 'https://daodegen.com/v1/sermon/anonymous/callback'

  const config = {
    version: 2,
    appName: 'Dao DeGen Temple',
    scope: SELF_SCOPE,
    endpoint,
    endpointType: 'staging_https',
    userId,
    userIdType: 'hex',
    disclosures: {},
  }

  return `https://self.xyz/verify?selfApp=${encodeURIComponent(JSON.stringify(config))}`
}

export function PrivatePrayerToggle({
  onModeChange,
  onProofGenerated,
}: PrivatePrayerToggleProps) {
  const { address } = useAccount()
  const [mode, setMode] = useState<PrayerMode>('standard')
  const [showQR, setShowQR] = useState(false)
  const [proofStatus, setProofStatus] = useState<'idle' | 'pending' | 'verified' | 'error'>('idle')

  const handleToggle = useCallback(() => {
    const newMode = mode === 'standard' ? 'private' : 'standard'
    setMode(newMode)
    setShowQR(false)
    setProofStatus('idle')
    onModeChange?.(newMode)
  }, [mode, onModeChange])

  const handleGenerateProof = useCallback(() => {
    setShowQR(true)
    setProofStatus('pending')
  }, [])

  // In a full integration, the Self app would callback to our endpoint
  // and we'd receive the proof. For the hackathon demo, we provide a
  // manual proof submission flow.
  const handleManualProofSubmit = useCallback(async () => {
    // Demo: simulate proof generation for testing
    // In production, the Self mobile app generates this via NFC passport scan
    const demoProof: SelfProofData = {
      attestationId: 1,
      proof: {
        a: ['0x0', '0x0'],
        b: [['0x0', '0x0'], ['0x0', '0x0']],
        c: ['0x0', '0x0'],
      },
      publicSignals: [],
    }
    setProofStatus('verified')
    onProofGenerated?.(demoProof)
  }, [onProofGenerated])

  const selfLink = address
    ? buildSelfUniversalLink(address)
    : null

  return (
    <div className="space-y-3">
      {/* Toggle Switch */}
      <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-200">
            {mode === 'standard' ? 'Standard Prayer' : 'Private Prayer'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {mode === 'standard'
              ? 'Wallet address linked to prayer'
              : 'Self Protocol ZK proof — wallet hidden'}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            mode === 'private' ? 'bg-dao-purple' : 'bg-slate-600'
          }`}
          aria-label="Toggle private prayer mode"
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              mode === 'private' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Private Mode Content */}
      {mode === 'private' && (
        <div className="p-4 bg-slate-900/60 rounded-lg border border-dao-purple/30 space-y-3">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-dao-purple mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="text-xs text-gray-300">
              Your burn history is visible on-chain, but your prayer <em>content</em> and{' '}
              <em>intent</em> can be private. Self Protocol ZK proofs verify you are a real
              human without exposing your wallet address.
            </p>
          </div>

          {proofStatus === 'idle' && (
            <button
              onClick={handleGenerateProof}
              className="w-full bg-dao-purple/20 hover:bg-dao-purple/30 text-dao-purple border border-dao-purple/40 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Generate ZK Proof with Self
            </button>
          )}

          {proofStatus === 'pending' && showQR && selfLink && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center">
                Scan with the Self mobile app to generate your ZK proof
              </p>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={selfLink}
                  size={200}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>
              <div className="text-center space-y-2">
                <p className="text-xs text-gray-500">
                  Or open on mobile:{' '}
                  <a
                    href={selfLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-dao-purple hover:underline"
                  >
                    Open Self App
                  </a>
                </p>
                {/* Demo button for hackathon testing */}
                <button
                  onClick={handleManualProofSubmit}
                  className="text-xs text-gray-500 hover:text-gray-400 underline"
                >
                  (Demo: simulate proof for testing)
                </button>
              </div>
            </div>
          )}

          {proofStatus === 'pending' && !selfLink && (
            <p className="text-xs text-amber-400 text-center">
              Connect your wallet first — your address is used only to generate the QR code,
              not stored with your prayer.
            </p>
          )}

          {proofStatus === 'verified' && (
            <div className="flex items-center gap-2 p-2 bg-green-900/20 border border-green-700/30 rounded-lg">
              <svg
                className="w-4 h-4 text-green-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <p className="text-xs text-green-400">
                ZK proof verified. Your prayer will be submitted anonymously.
              </p>
            </div>
          )}

          {proofStatus === 'error' && (
            <div className="flex items-center gap-2 p-2 bg-red-900/20 border border-red-700/30 rounded-lg">
              <p className="text-xs text-red-400">
                Proof verification failed. Please try again.
              </p>
              <button
                onClick={() => setProofStatus('idle')}
                className="text-xs text-red-300 hover:text-red-200 underline ml-auto"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export type { PrayerMode }
