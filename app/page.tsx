import dynamic from "next/dynamic"

const TradeApp = dynamic(() => import("./components/TradeApp"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-[#070a12]">
      <div className="w-8 h-8 border-2 border-white/10 border-t-[#00d4ff] rounded-full animate-spin" />
    </div>
  ),
})

export default function Home() {
  return <TradeApp />
}
