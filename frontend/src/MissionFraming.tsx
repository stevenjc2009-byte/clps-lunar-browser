import './heatmap.css'

// Spec 8.3: what a lander needs, what this tool measures, and what it does not.
// Plain statements only; no mission numbers.
export default function MissionFraming() {
  return (
    <div className="mission">
      <section aria-labelledby="mf-needs">
        <h3 id="mf-needs">What a lander needs</h3>
        <p>CLPS (Commercial Lunar Payload Services) is NASA buying rides to the Moon from companies, whose
          robotic landers carry NASA experiments. Near the south pole such a lander needs two things above all:</p>
        <ul>
          <li><b>Power.</b> A solar-powered lander only makes power while the Sun is up. When the Sun is behind the
            skyline it lives on batteries in deep cold, so long nights are the danger.</li>
          <li><b>Radio home.</b> It can only talk to Earth directly while Earth is above its skyline, and while one of
            NASA's big Deep Space Network dishes (California, Spain or Australia) can see the Moon.</li>
        </ul>
      </section>
      <section aria-labelledby="mf-is">
        <h3 id="mf-is">What this tool is</h3>
        <ul>
          <li>A "what if" comparison: if a lander touched down at this site on this date, how often would the Sun and
            Earth be in view?</li>
          <li>Built from NASA JPL positions of the Sun, Earth and Moon, the same for every site, so sites can be
            compared fairly.</li>
          <li>A team entry for the NASA Space Apps Challenge 2026. It is not an official NASA product.</li>
        </ul>
      </section>
      <section aria-labelledby="mf-not">
        <h3 id="mf-not">What it is not</h3>
        <ul>
          <li>Not a mission-planning tool. Real missions use far more detailed studies.</li>
          <li>No heat or cold modelling, no battery or solar-panel sizing, and no check of how strong the radio signal
            is (a "link budget").</li>
          <li>No check of whether the ground is safe to land on or drive across (slopes, boulders, soft soil).</li>
        </ul>
      </section>
    </div>
  )
}
