import ErrorForm from './components/ErrorForm.jsx'

export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <main className="mx-auto max-w-3xl px-4 py-12">
        <header>
          <h1 className="text-4xl font-bold text-amber-400">Glitch Detective</h1>
          <p className="mt-2 text-zinc-400">
            Paste the error. Understand why. Practice so it never happens again.
          </p>
        </header>
        <ErrorForm onSubmit={() => {}} loading={false} />
      </main>
    </div>
  )
}
