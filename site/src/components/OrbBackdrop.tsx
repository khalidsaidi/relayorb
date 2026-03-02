export function OrbBackdrop() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_20%_10%,rgba(88,198,255,0.22),transparent_35%),radial-gradient(circle_at_78%_20%,rgba(129,140,248,0.17),transparent_38%),radial-gradient(circle_at_52%_78%,rgba(45,212,191,0.12),transparent_45%),linear-gradient(150deg,#04060e_0%,#0a1020_45%,#11182b_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(126,150,190,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(126,150,190,0.08)_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(circle_at_center,black,transparent_90%)]" />
      <div className="pointer-events-none fixed -top-[22rem] left-[-18rem] -z-10 h-[42rem] w-[42rem] rounded-full border border-cyan-300/20 [animation:spin_80s_linear_infinite]" />
      <div className="pointer-events-none fixed right-[-14rem] bottom-[-18rem] -z-10 h-[34rem] w-[34rem] rounded-full border border-indigo-300/20 [animation:spin_95s_linear_infinite_reverse]" />
    </>
  );
}
