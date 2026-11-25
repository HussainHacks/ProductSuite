export type QuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "rating"
  | "date"
  | "number"
  | "email";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  dropdown: "Dropdown",
  rating: "Rating (1–5)",
  date: "Date",
  number: "Number",
  email: "Email",
};

export interface Question {
  id: number;
  form_id: number;
  prompt: string;
  question_type: QuestionType;
  required: boolean;
  options: string[];
  position: number;
}

export interface FormItem {
  id: number;
  title: string;
  description: string;
  is_published: boolean;
  public_slug: string;
  created_at: string;
  updated_at: string;
  questions: Question[];
  response_count: number;
}

export interface FormResponseItem {
  id: number;
  form_id: number;
  respondent_label: string;
  answers: Record<string, unknown>;
  created_at: string;
}

export interface QuestionSummary {
  question_id: number;
  prompt: string;
  question_type: QuestionType;
  total_answers: number;
  breakdown: Record<string, number>;
  average_rating: number | null;
  sample_values: string[];
}

export interface FormSummary {
  form_id: number;
  title: string;
  total_responses: number;
  questions: QuestionSummary[];
}
