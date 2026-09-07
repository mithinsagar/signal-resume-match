/**
 * Skill ontology.
 *
 * Every entry maps a canonical skill name to the strings people actually write.
 * The aliases matter more than the canonical name: a resume says "postgres",
 * "PostgreSQL" and "psql" interchangeably, and a matcher that only knows one of
 * them reports a gap that isn't there — the single most common way naive
 * keyword matching produces a wrong score.
 *
 * Matching is whole-token and case-insensitive (see `buildMatcher`), so short
 * aliases like "r", "go" and "c" are safe to include: they only fire when they
 * stand alone, never inside "react" or "google" or "c++".
 */

import type { SkillCategory } from "./types";

export interface SkillDefinition {
  skill: string;
  category: SkillCategory;
  aliases: string[];
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  languages: "Languages",
  frameworks: "Frameworks",
  data: "Data & Analytics",
  ml: "Machine Learning",
  cloud: "Cloud",
  devops: "DevOps & Tooling",
  databases: "Databases",
  practices: "Engineering Practice",
  design: "Design & Frontend",
  soft: "Ways of Working",
};

export const CATEGORY_ORDER: SkillCategory[] = [
  "languages",
  "frameworks",
  "ml",
  "data",
  "databases",
  "cloud",
  "devops",
  "design",
  "practices",
  "soft",
];

export const SKILLS: SkillDefinition[] = [
  // ---------------------------------------------------------------- languages
  { skill: "Python", category: "languages", aliases: ["python", "python3", "py"] },
  { skill: "JavaScript", category: "languages", aliases: ["javascript", "js", "es6", "ecmascript"] },
  { skill: "TypeScript", category: "languages", aliases: ["typescript", "ts"] },
  { skill: "Java", category: "languages", aliases: ["java", "java8", "java11", "java17"] },
  { skill: "C++", category: "languages", aliases: ["c++", "cpp", "cplusplus"] },
  { skill: "C", category: "languages", aliases: ["c"] },
  { skill: "C#", category: "languages", aliases: ["c#", "csharp", "dotnet", ".net"] },
  { skill: "Go", category: "languages", aliases: ["go", "golang"] },
  { skill: "Rust", category: "languages", aliases: ["rust"] },
  { skill: "Ruby", category: "languages", aliases: ["ruby"] },
  { skill: "PHP", category: "languages", aliases: ["php"] },
  { skill: "Swift", category: "languages", aliases: ["swift"] },
  { skill: "Kotlin", category: "languages", aliases: ["kotlin"] },
  { skill: "Scala", category: "languages", aliases: ["scala"] },
  { skill: "R", category: "languages", aliases: ["r"] },
  { skill: "MATLAB", category: "languages", aliases: ["matlab"] },
  { skill: "SQL", category: "languages", aliases: ["sql", "ansi sql"] },
  { skill: "Bash", category: "languages", aliases: ["bash", "shell", "zsh", "shell scripting"] },
  { skill: "Objective-C", category: "languages", aliases: ["objective-c", "objective c", "objc"] },
  { skill: "Perl", category: "languages", aliases: ["perl"] },
  { skill: "Haskell", category: "languages", aliases: ["haskell"] },
  { skill: "Elixir", category: "languages", aliases: ["elixir"] },
  { skill: "Dart", category: "languages", aliases: ["dart"] },
  { skill: "Assembly", category: "languages", aliases: ["assembly", "asm", "assembly language"] },
  { skill: "Julia", category: "languages", aliases: ["julia"] },
  { skill: "Solidity", category: "languages", aliases: ["solidity"] },

  // --------------------------------------------------------------- frameworks
  { skill: "React", category: "frameworks", aliases: ["react", "reactjs", "react.js"] },
  { skill: "Next.js", category: "frameworks", aliases: ["next.js", "nextjs", "next js"] },
  { skill: "Vue", category: "frameworks", aliases: ["vue", "vuejs", "vue.js", "nuxt"] },
  { skill: "Angular", category: "frameworks", aliases: ["angular", "angularjs"] },
  { skill: "Svelte", category: "frameworks", aliases: ["svelte", "sveltekit"] },
  { skill: "Node.js", category: "frameworks", aliases: ["node", "node.js", "nodejs"] },
  { skill: "Express", category: "frameworks", aliases: ["express", "expressjs", "express.js"] },
  { skill: "Django", category: "frameworks", aliases: ["django"] },
  { skill: "Flask", category: "frameworks", aliases: ["flask"] },
  { skill: "FastAPI", category: "frameworks", aliases: ["fastapi", "fast api"] },
  { skill: "Spring", category: "frameworks", aliases: ["spring", "spring boot", "springboot"] },
  { skill: "Rails", category: "frameworks", aliases: ["rails", "ruby on rails"] },
  { skill: "Streamlit", category: "frameworks", aliases: ["streamlit"] },
  { skill: "React Native", category: "frameworks", aliases: ["react native"] },
  { skill: "Flutter", category: "frameworks", aliases: ["flutter"] },
  { skill: "Unity", category: "frameworks", aliases: ["unity", "unity3d"] },
  { skill: "NestJS", category: "frameworks", aliases: ["nestjs", "nest.js"] },
  { skill: "Laravel", category: "frameworks", aliases: ["laravel"] },
  { skill: "ASP.NET Core", category: "frameworks", aliases: ["asp.net core", "asp.net", "aspnet"] },
  { skill: "Gatsby", category: "frameworks", aliases: ["gatsby", "gatsbyjs"] },
  { skill: "Remix", category: "frameworks", aliases: ["remix"] },
  { skill: "Electron", category: "frameworks", aliases: ["electron", "electronjs"] },
  { skill: "Ionic", category: "frameworks", aliases: ["ionic"] },
  { skill: "Redux", category: "frameworks", aliases: ["redux", "redux toolkit", "rtk"] },
  { skill: "Zustand", category: "frameworks", aliases: ["zustand"] },
  { skill: "MobX", category: "frameworks", aliases: ["mobx"] },
  { skill: "React Query", category: "frameworks", aliases: ["react query", "tanstack query", "tanstack"] },
  { skill: "SwiftUI", category: "frameworks", aliases: ["swiftui", "swift ui"] },
  { skill: "Jetpack Compose", category: "frameworks", aliases: ["jetpack compose"] },

  // ----------------------------------------------------------------------- ml
  { skill: "Machine Learning", category: "ml", aliases: ["machine learning", "ml", "statistical learning"] },
  { skill: "Deep Learning", category: "ml", aliases: ["deep learning", "dl", "neural networks", "neural network"] },
  { skill: "PyTorch", category: "ml", aliases: ["pytorch", "torch"] },
  { skill: "TensorFlow", category: "ml", aliases: ["tensorflow", "tf"] },
  { skill: "Keras", category: "ml", aliases: ["keras"] },
  { skill: "scikit-learn", category: "ml", aliases: ["scikit-learn", "sklearn", "scikit learn"] },
  { skill: "XGBoost", category: "ml", aliases: ["xgboost", "lightgbm", "catboost", "gradient boosting"] },
  { skill: "NLP", category: "ml", aliases: ["nlp", "natural language processing", "text mining"] },
  { skill: "Computer Vision", category: "ml", aliases: ["computer vision", "cv", "opencv", "image processing"] },
  { skill: "LLMs", category: "ml", aliases: ["llm", "llms", "large language model", "large language models", "gpt", "prompt engineering"] },
  { skill: "RAG", category: "ml", aliases: ["rag", "retrieval augmented generation", "retrieval-augmented"] },
  { skill: "Transformers", category: "ml", aliases: ["transformer", "transformers", "bert", "sbert", "hugging face", "huggingface"] },
  { skill: "Explainable AI", category: "ml", aliases: ["explainable ai", "xai", "shap", "lime", "interpretability", "model interpretability"] },
  { skill: "MLOps", category: "ml", aliases: ["mlops", "model deployment", "model serving", "mlflow"] },
  { skill: "Vector Search", category: "ml", aliases: ["faiss", "vector database", "vector search", "pinecone", "chromadb", "embeddings"] },
  { skill: "Reinforcement Learning", category: "ml", aliases: ["reinforcement learning", "rl"] },
  { skill: "GANs", category: "ml", aliases: ["gan", "gans", "generative adversarial network", "generative adversarial networks"] },
  { skill: "Time Series Forecasting", category: "ml", aliases: ["time series", "time series forecasting", "time series analysis"] },
  { skill: "Recommendation Systems", category: "ml", aliases: ["recommendation system", "recommendation systems", "recommender system", "recommender systems"] },
  { skill: "AutoML", category: "ml", aliases: ["automl", "auto-ml", "automated machine learning"] },
  { skill: "ONNX", category: "ml", aliases: ["onnx"] },
  { skill: "LLM Orchestration", category: "ml", aliases: ["langchain", "llamaindex", "llama index"] },

  // --------------------------------------------------------------------- data
  { skill: "pandas", category: "data", aliases: ["pandas"] },
  { skill: "NumPy", category: "data", aliases: ["numpy"] },
  { skill: "Spark", category: "data", aliases: ["spark", "pyspark", "apache spark"] },
  { skill: "Airflow", category: "data", aliases: ["airflow", "apache airflow", "dagster", "prefect"] },
  { skill: "ETL", category: "data", aliases: ["etl", "elt", "data pipeline", "data pipelines", "data engineering"] },
  { skill: "Data Visualization", category: "data", aliases: ["data visualization", "data visualisation", "matplotlib", "seaborn", "plotly", "d3", "d3.js"] },
  { skill: "Tableau", category: "data", aliases: ["tableau", "power bi", "powerbi", "looker"] },
  { skill: "Statistics", category: "data", aliases: ["statistics", "statistical analysis", "hypothesis testing", "a/b testing", "ab testing"] },
  { skill: "Kafka", category: "data", aliases: ["kafka", "streaming", "event streaming"] },
  { skill: "dbt", category: "data", aliases: ["dbt", "data build tool"] },
  { skill: "Databricks", category: "data", aliases: ["databricks"] },
  { skill: "Feature Engineering", category: "data", aliases: ["feature engineering", "feature store"] },
  { skill: "Data Quality", category: "data", aliases: ["data quality", "great expectations", "data validation"] },

  // ---------------------------------------------------------------- databases
  { skill: "PostgreSQL", category: "databases", aliases: ["postgresql", "postgres", "psql"] },
  { skill: "MySQL", category: "databases", aliases: ["mysql", "mariadb"] },
  { skill: "MongoDB", category: "databases", aliases: ["mongodb", "mongo"] },
  { skill: "Redis", category: "databases", aliases: ["redis"] },
  { skill: "SQLite", category: "databases", aliases: ["sqlite"] },
  { skill: "DynamoDB", category: "databases", aliases: ["dynamodb", "dynamo"] },
  { skill: "Elasticsearch", category: "databases", aliases: ["elasticsearch", "opensearch", "elastic"] },
  { skill: "Snowflake", category: "databases", aliases: ["snowflake", "bigquery", "redshift", "data warehouse"] },
  { skill: "Cassandra", category: "databases", aliases: ["cassandra"] },
  { skill: "Neo4j", category: "databases", aliases: ["neo4j", "graph database"] },
  { skill: "Supabase", category: "databases", aliases: ["supabase"] },
  { skill: "Firebase", category: "databases", aliases: ["firebase", "firestore"] },

  // -------------------------------------------------------------------- cloud
  { skill: "AWS", category: "cloud", aliases: ["aws", "amazon web services", "ec2", "s3", "lambda", "cloudwatch"] },
  { skill: "Azure", category: "cloud", aliases: ["azure", "microsoft azure"] },
  { skill: "GCP", category: "cloud", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { skill: "Serverless", category: "cloud", aliases: ["serverless", "cloud functions", "faas"] },
  { skill: "Cloud Architecture", category: "cloud", aliases: ["cloud architecture", "distributed systems", "system design", "scalability"] },
  { skill: "Heroku", category: "cloud", aliases: ["heroku"] },
  { skill: "DigitalOcean", category: "cloud", aliases: ["digitalocean", "digital ocean"] },
  { skill: "Vercel", category: "cloud", aliases: ["vercel"] },
  { skill: "CDN", category: "cloud", aliases: ["cdn", "content delivery network", "cloudfront"] },

  // ------------------------------------------------------------------- devops
  { skill: "Docker", category: "devops", aliases: ["docker", "containers", "containerization"] },
  { skill: "Kubernetes", category: "devops", aliases: ["kubernetes", "k8s", "eks", "gke"] },
  { skill: "CI/CD", category: "devops", aliases: ["ci/cd", "cicd", "continuous integration", "continuous deployment", "github actions", "jenkins", "gitlab ci"] },
  { skill: "Terraform", category: "devops", aliases: ["terraform", "infrastructure as code", "iac", "pulumi", "cloudformation"] },
  { skill: "Git", category: "devops", aliases: ["git", "github", "gitlab", "version control"] },
  { skill: "Linux", category: "devops", aliases: ["linux", "unix", "ubuntu"] },
  { skill: "Monitoring", category: "devops", aliases: ["monitoring", "observability", "prometheus", "grafana", "datadog", "logging"] },
  { skill: "Ansible", category: "devops", aliases: ["ansible"] },
  { skill: "Nginx", category: "devops", aliases: ["nginx"] },
  { skill: "Helm", category: "devops", aliases: ["helm chart", "helm charts", "helm"] },
  { skill: "ArgoCD", category: "devops", aliases: ["argocd", "argo cd"] },

  // ------------------------------------------------------------------- design
  { skill: "HTML/CSS", category: "design", aliases: ["html", "css", "html5", "css3", "scss", "sass"] },
  { skill: "Tailwind CSS", category: "design", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { skill: "UI/UX", category: "design", aliases: ["ui/ux", "ux", "user experience", "user interface", "interaction design"] },
  { skill: "Figma", category: "design", aliases: ["figma", "sketch", "adobe xd"] },
  { skill: "Accessibility", category: "design", aliases: ["accessibility", "a11y", "wcag"] },
  { skill: "Responsive Design", category: "design", aliases: ["responsive design", "responsive", "mobile-first"] },
  { skill: "Webpack", category: "design", aliases: ["webpack"] },
  { skill: "Vite", category: "design", aliases: ["vite"] },
  { skill: "Storybook", category: "design", aliases: ["storybook"] },
  { skill: "Linting & Formatting", category: "design", aliases: ["eslint", "prettier", "linting"] },
  { skill: "CMS", category: "design", aliases: ["wordpress", "contentful", "strapi", "sanity", "cms", "content management system"] },
  { skill: "UI Component Libraries", category: "design", aliases: ["bootstrap", "material ui", "material-ui", "mui", "chakra ui", "chakra", "ant design", "antd"] },
  { skill: "CSS-in-JS", category: "design", aliases: ["styled-components", "styled components", "css-in-js", "emotion"] },

  // ---------------------------------------------------------------- practices
  { skill: "Testing", category: "practices", aliases: ["testing", "unit testing", "unit tests", "pytest", "jest", "vitest", "test-driven", "tdd"] },
  { skill: "REST APIs", category: "practices", aliases: ["rest", "rest api", "restful", "api design"] },
  { skill: "GraphQL", category: "practices", aliases: ["graphql", "apollo"] },
  { skill: "Microservices", category: "practices", aliases: ["microservices", "microservice", "service oriented"] },
  { skill: "Code Review", category: "practices", aliases: ["code review", "peer review", "pull request", "pull requests"] },
  { skill: "Agile", category: "practices", aliases: ["agile", "scrum", "kanban", "sprint", "sprints"] },
  { skill: "Security", category: "practices", aliases: ["security", "authentication", "authorization", "oauth", "encryption", "owasp"] },
  { skill: "Performance", category: "practices", aliases: ["performance optimization", "performance tuning", "profiling", "caching"] },
  { skill: "Documentation", category: "practices", aliases: ["documentation", "technical writing"] },
  { skill: "gRPC", category: "practices", aliases: ["grpc", "protobuf", "protocol buffers"] },
  { skill: "Message Queues", category: "practices", aliases: ["message queue", "message queues", "rabbitmq", "amqp", "sqs"] },
  { skill: "Design Patterns", category: "practices", aliases: ["design patterns", "design pattern"] },
  { skill: "SOLID Principles", category: "practices", aliases: ["solid principles", "solid design"] },
  { skill: "Event-Driven Architecture", category: "practices", aliases: ["event-driven", "event driven", "event-driven architecture"] },
  { skill: "E2E Testing", category: "practices", aliases: ["cypress", "playwright", "selenium", "webdriver", "end-to-end testing", "e2e testing"] },
  { skill: "API Tooling", category: "practices", aliases: ["postman", "swagger", "openapi"] },
  { skill: "Project Management Tools", category: "practices", aliases: ["jira", "confluence", "trello", "asana"] },
  { skill: "Web3", category: "practices", aliases: ["web3", "ethereum", "smart contracts"] },

  // --------------------------------------------------------------------- soft
  { skill: "Collaboration", category: "soft", aliases: ["collaboration", "cross-functional", "teamwork", "team player"] },
  { skill: "Communication", category: "soft", aliases: ["communication", "stakeholder", "presenting", "presentation"] },
  { skill: "Leadership", category: "soft", aliases: ["leadership", "mentoring", "mentorship", "led a team", "team lead"] },
  { skill: "Problem Solving", category: "soft", aliases: ["problem solving", "problem-solving", "analytical thinking"] },
  { skill: "Ownership", category: "soft", aliases: ["ownership", "end-to-end", "self-directed", "autonomy"] },
  { skill: "Adaptability", category: "soft", aliases: ["adaptability", "adaptable", "fast-paced environment"] },
];

/**
 * Phrases that mark the *following* skill mention as a hard requirement rather
 * than a nice-to-have. Used to weight the job description: a skill introduced
 * by "must have" should cost more when missing than one under "bonus points".
 */
export const REQUIREMENT_MARKERS = [
  "must have",
  "must-have",
  "required",
  "requirement",
  "requirements",
  "you have",
  "you will need",
  "we require",
  "essential",
  "minimum qualification",
  "minimum qualifications",
  "proficient in",
  "proficiency in",
  "strong experience",
  "expertise in",
  "deep knowledge",
];

export const NICE_TO_HAVE_MARKERS = [
  "nice to have",
  "nice-to-have",
  "bonus",
  "plus",
  "preferred",
  "desirable",
  "advantage",
  "familiarity with",
  "exposure to",
  "a plus",
  "good to have",
];

/**
 * Language near a resume skill mention that reads as demonstrated depth
 * rather than a bare keyword — years of experience, ownership, production
 * use. Used only for the auxiliary proficiency label; never the score.
 */
export const PROFICIENCY_STRONG_MARKERS = [
  "years", "yrs", "year of", "led", "owned", "architected", "built", "shipped",
  "deployed", "scaled", "production", "senior", "expert", "advanced",
  "extensive experience", "deep experience", "proficient", "mastery",
  "spearheaded", "drove", "managed",
];

/**
 * Language near a resume skill mention that reads as early or partial
 * exposure rather than demonstrated depth — coursework, self-study, a toy
 * project. Same caveat as above: a proximity heuristic, not a judgment.
 */
export const PROFICIENCY_WEAK_MARKERS = [
  "familiar with", "familiarity with", "exposure to", "basic", "beginner",
  "learning", "currently learning", "some experience", "introductory",
  "coursework", "academic project", "personal project", "side project",
  "self-taught", "intro to",
];

/** Total distinct skills the ontology can recognise, surfaced in the UI. */
export const SKILL_COUNT = SKILLS.length;

/** Total distinct surface forms, i.e. how many spellings it tolerates. */
export const ALIAS_COUNT = SKILLS.reduce((n, s) => n + s.aliases.length, 0);
