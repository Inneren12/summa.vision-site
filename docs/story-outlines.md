# Scrollytelling Story Outlines

## Energy Story Draft

### Narrative Voice and Accessibility
- **Tone:** Analytical yet reassuring, explaining complexities in plain language while highlighting pragmatic solutions.
- **Motion Preferences:** Respect `prefers-reduced-motion`; provide static fallbacks for animated transitions and allow manual advance controls.

### Parameter Bindings
- **Year:** Primary views default to 2010–2024 with a slider, synced across charts; snapshots at 2010, 2015, 2020, 2024 for narrative beats.
- **Region:** Global baseline with drilldowns to North America, Europe, and Asia-Pacific; selector persists between sections.

### Scrollytelling Sections & Charts
1. **Energy Demand Baseline**
   - **Focus:** Global final energy consumption trends.
   - **Chart:** Stacked area chart showing consumption by sector (industry, transport, buildings, others).
2. **Efficiency Gains**
   - **Focus:** Improvements in energy intensity relative to GDP.
   - **Chart:** Dual-axis line chart (energy intensity vs. GDP growth) with highlighting for key policy years.
3. **Renewable Adoption Surge**
   - **Focus:** Growth in renewable generation share.
   - **Chart:** Animated slope graph comparing renewable vs. fossil generation share by region; static small multiples when reduced motion is enabled.
4. **Grid Flexibility & Storage**
   - **Focus:** Expansion of storage capacity and demand-response programs.
   - **Chart:** Bubble map of storage projects sized by capacity, filtered by region.
5. **Projected Emissions Path**
   - **Focus:** Forecasted emissions under current policies vs. accelerated transition.
   - **Chart:** Scenario line chart with confidence intervals and annotation callouts for inflection points.

### Data Requirements & Licensing
- **International Energy Agency (IEA) World Energy Balances** for consumption and sectoral breakdown; requires paid license or explicit permission for redistribution.
- **IEA Energy Efficiency Indicators** for intensity metrics; same licensing considerations.
- **Renewable capacity datasets** (IRENA Renewable Capacity Statistics); check Creative Commons Attribution (CC BY 3.0 IGO) requirements for attribution.
- **Global Energy Storage Database (DOE NREL)**; verify open access terms and attribution needs.
- **Climate Action Tracker or IPCC scenario data** for emission pathways; ensure compliance with public-use guidelines and cite appropriately.

## Technology Story Draft

### Narrative Voice and Accessibility
- **Tone:** Forward-looking and optimistic, emphasizing human impact stories while grounding claims in data.
- **Motion Preferences:** Support reduced motion by substituting fade/scroll transitions with instant layout shifts and descriptive captions.

### Parameter Bindings
- **Year:** Focus on 2015–2024 with highlight years 2016, 2020, 2023; allow jump-to-year buttons synchronized across visuals.
- **Region:** Global overview with toggles for emerging markets (India, Nigeria, Brazil) vs. mature markets (US, EU, Japan).

### Scrollytelling Sections & Charts
1. **Connectivity Leap**
   - **Focus:** Expansion of broadband and mobile internet access.
   - **Chart:** Choropleth map with time slider; reduced-motion mode swaps to small multiple maps for key years.
2. **Digital Inclusion Programs**
   - **Focus:** Adoption of community networks and affordability initiatives.
   - **Chart:** Barbell plot comparing cost-to-income ratios before and after intervention by region.
3. **Startup Ecosystem Growth**
   - **Focus:** Venture funding and startup density in frontier tech hubs.
   - **Chart:** Animated scatter plot (funding vs. startup count) with cluster highlights; static scatter snapshots for reduced motion.
4. **AI Adoption in Industry**
   - **Focus:** Uptake of AI tools across sectors.
   - **Chart:** Heatmap of adoption rates by sector and region with interactive tooltips.
5. **Human Outcomes**
   - **Focus:** Impacts on education, health, and income.
   - **Chart:** Connected dot plots showing change in key indicators pre/post digital transformation initiatives.

### Data Requirements & Licensing
- **International Telecommunication Union (ITU) ICT Indicators** for connectivity data; check publication rights (typically open with attribution).
- **Alliance for Affordable Internet (A4AI) Affordability Drivers Index**; ensure compliance with CC BY 4.0 licensing.
- **Crunchbase or PitchBook datasets** for startup funding; likely requires commercial license or agreement.
- **OECD and McKinsey AI adoption surveys**; confirm usage rights for visual storytelling.
- **World Bank World Development Indicators** for education/health/income metrics; open under Creative Commons Attribution 4.0.
