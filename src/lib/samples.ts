/**
 * Sample documents.
 *
 * Here so the app is explorable without asking a first-time visitor to paste
 * their own resume before they know whether the tool is any good. The pair is
 * deliberately an imperfect match — a strong backend/ML candidate against a
 * role that also wants cloud and infrastructure depth — because a demo that
 * scores 98 demonstrates nothing about the gap analysis, which is the part
 * worth seeing.
 */

export const SAMPLE_RESUME = `PRIYA NARAYANAN
priya.narayanan@example.com | +91 98765 43210 | Bengaluru, India
github.com/example | linkedin.com/in/example

SUMMARY
Machine learning engineer with 3 years building and shipping NLP systems in
production. Comfortable owning a model end to end: data pipeline, training,
evaluation, serving and the dashboard the business actually looks at.

EXPERIENCE

Senior ML Engineer — Fintech Analytics Co. (2023 - present)
- Built a transaction classification service in Python and PyTorch, serving
  1.2M requests per day at p99 latency of 84ms.
- Designed the retraining pipeline with Airflow, cutting model staleness from
  30 days to 4 and improving F1 by 11 percentage points.
- Implemented SHAP-based explanations for every decision, which reduced manual
  review escalations by 38%.
- Led code review for a team of 4 engineers and mentored 2 interns.

ML Engineer — Retail Intelligence Startup (2022 - 2023)
- Developed a semantic search feature over 400k product listings using SBERT
  embeddings and FAISS, increasing search conversion by 17%.
- Wrote the FastAPI service layer and its pytest suite, reaching 87% coverage.
- Migrated batch jobs from cron to Airflow, eliminating a recurring class of
  silent failure.

Data Science Intern — Logistics Firm (2021)
- Built demand forecasting models with scikit-learn and XGBoost, beating the
  existing heuristic baseline by 23% on MAPE.

PROJECTS

Explainable Credit Scoring (2023)
- Trained gradient boosting models on 180k loan records, then implemented LIME
  and Shapley attribution from first principles to audit them.
- Published the evaluation notebook and a Streamlit dashboard.

EDUCATION
B.Tech, Computer Science — 2021
Coursework: machine learning, distributed systems, statistics, algorithms

SKILLS
Python, SQL, PyTorch, scikit-learn, XGBoost, pandas, NumPy, FastAPI, Flask,
SBERT, FAISS, SHAP, LIME, Airflow, PostgreSQL, Redis, Docker, Git, pytest,
Linux, matplotlib, Streamlit`;

export const SAMPLE_JOB = `Senior Machine Learning Engineer — Platform
Remote (India) | Full-time

ABOUT THE ROLE
We are building the ML platform that every product team at the company deploys
on. You will own model serving infrastructure end to end and work directly with
product engineers to get their models into production safely.

REQUIREMENTS
- Strong experience with Python and production-grade ML systems.
- Proficiency in PyTorch or TensorFlow for training and serving.
- Must have hands-on experience with Kubernetes and Docker in production.
- Deep knowledge of AWS — EC2, S3, Lambda and CloudWatch specifically.
- Required: Terraform or equivalent infrastructure-as-code experience.
- Solid grounding in system design and distributed systems.
- Experience building and maintaining CI/CD pipelines.
- Strong SQL and comfort with data pipelines at scale.

NICE TO HAVE
- Familiarity with Kafka or other event streaming platforms.
- Exposure to model interpretability and explainable AI techniques.
- Experience with vector search or embedding-based retrieval.
- Monitoring and observability tooling — Prometheus, Grafana or Datadog.
- Prior work on MLOps tooling such as MLflow.

WHAT YOU WILL DO
- Design and operate the serving layer for models across the organisation.
- Build the deployment path so teams can ship a model without filing a ticket.
- Own reliability: monitoring, alerting, rollback and incident response.
- Collaborate with product and platform teams, and mentor engineers newer to
  production ML.

WHAT WE OFFER
Competitive compensation, remote-first culture, and a genuine engineering
budget for the infrastructure work this role depends on.`;
