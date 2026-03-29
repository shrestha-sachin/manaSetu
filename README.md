## Manasetu – An adaptive career guidance system that simplifies decisions based on your mental state.

Manasetu is a system designed to help students and professionals make better career decisions by adapting guidance based on their mental state. Research shows that a large percentage of individuals experience stress, burnout, and decision fatigue when choosing career paths, which often leads to confusion, delay, or poor decisions.

Unlike traditional career platforms that provide more options, Manasetu takes a different approach. It simplifies decisions when users feel overwhelmed and highlights manageable, actionable steps to help them continue making progress toward their goals.

The system works by combining a user’s career goal with a simple burnout assessment (such as stress, energy, and sleep levels). Based on this, it dynamically adjusts a visual career roadmap—showing more detailed paths when the user is in a stable state and reducing complexity when the user is under stress.

Manasetu is not a medical or therapy tool. It does not diagnose or treat mental health conditions. Instead, it functions as a decision-support system aimed at reducing pressure, improving clarity, and helping users take consistent, meaningful steps toward their career goals.

---

## 🌩️ Technical Architecture

### **Frontend: The Sanctuary (React + Vite)**
- **Visualization**: Leverages `React Flow` to render a reactive, SVG-based Directed Acyclic Graph (DAG) for the career roadmap.
- **State Orchestration**: A central `Dashboard.tsx` controller manages global energy states, academic calibration levels, and the dynamic "Thermal Shift" CSS logic.
- **Micro-Animations**: Custom CSS animations (`animate-breath`, `animate-pulse-slow`) provide a living, organic feel to the restorative segments.

### **Backend: The Engine (Python + FastAPI + Modal)**
- **Serverless Compute**: Infrastructure managed via `Modal.com`, allowing for cost-effective, high-performance Python execution.
- **AI Integration**: Deep integration with **xAI (Grok-4.20)** for generating procedurally accurate career trajectories tailored to specific majors and skills.
- **Data Persistence**: **Supabase (PostgreSQL)** handles user profiles, academic levels, and longitudinal burnout check-in logs.

---

##  Core Features in Detail

### 🗺️ AI Career Roadmapping Engine
- **Procedural Generation**: Unlike static roadmaps, ManaSetu uses a sophisticated prompt-chaining system to generate 6-8 milestone nodes that reflect the user's current academic year, skills, and energy levels.
- **Smart Pacing**: When the energy pulse is in the "Risk" zone, the AI automatically includes "Quiet Wins" and "Low-Stress Milestones" to prevent further exhaustion.
- **Interactive Nodes**: Each node contains a checklist of 3-5 actionable items and verified external resources (e.g., Coursera, MDN, LinkedIn Learning).

###  Restorative Utilities (Focus Command Center)
- **Oasis Breath**: A full-screen, 8-second rhythmic breathing guide. It uses a multi-layered CSS pulse to help students physiologically reset their nervous system.
- **Zen Reflection**: A contemplative space for daily intention setting. It features an immersive blur modal that silences the rest of the app to allow for cognitive alignment.
- **Momentum Check**: Designed to solve decision paralysis, this feature identifies the "Smallest Step"—the single most achievable next milestone on the roadmap.

###  Academic Calibration
- **Stage Tracking**: Captures the user's specific progress (Year 1-4, Grad, or PhD) to ensure the career trajectory matches their current educational context.
- **Historical Analysis**: Every burnout check-in is logged with the user's academic level, allowing for future trend analysis of student stress across the academic lifecycle.

---

##  Local Development and Deployment

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **Modal Account** (for serverless backend)
- **Supabase Account** (for database)
- **xAI API Key** (for roadmap generation)

### 2. Backend Orchestration
```bash
cd backend
# Create and activate environment
python -m venv .venv
source .venv/bin/activate
# Install dependencies
pip install -r requirements.txt
# Launch the server (Modal will provide a public URL)
modal serve main.py
```

### 3. Frontend Execution
```bash
cd frontend
npm install
# Ensure .env contains VITE_API_BASE_URL (Modal URL)
npm run dev
```

### 4. Database Schema Update
Execute the following in your **Supabase SQL Editor** to enable the latest academic tracking:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_level TEXT DEFAULT 'Year 1';
ALTER TABLE burnout_checkins ADD COLUMN IF NOT EXISTS academic_level TEXT;
```

---

## 📂 Repository Structure
- `frontend/src/components/Dashboard.tsx`: Controls the "Silent Oasis" state and thermal transitions.
- `frontend/src/components/CareerMap/`: Contains the SVG graph rendering logic and custom Node/Edge definitions.
- `frontend/src/components/CapacityCheckin.tsx`: Handles the academic calibration and energyassessment flows.
- `backend/main.py`: The FastAPI server containing the AI prompts, hashing logic, and database connectors.
- `frontend/src/index.css`: The source of truth for all Oasis animations and design tokens.

---

## 🛠️ Configuration (Secret Management)
The following environment variables are required for a full deployment:

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend service key for DB bypass |
| `XAI_API_KEY` | xAI (Grok) API Key for roadmap engine |
| `VITE_API_BASE_URL` | Public URL of the FastAPI server |

---

##Team Members and Roles
Sachin Shrestha – Backend Development 
Sumit Karki – Frontend Development
Pitamaber – Frontend Development
Srijina Shrestha – Planning and Presentation
Himal Subedi – Planning and Presentation

---

## 🛡️ License & Mission
ManaSetu is built for the student community to foster a healthier relationship between ambition and well-being.
