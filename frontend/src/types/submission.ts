export type UploadedFile = { type: string; original: string; stored: string; dest_dir?: string };

export type Submission = {
  id: number;
  received_date: string;
  submission_date: string;
  qc_checker: string;
  team: string;
  client: string;
  rating: string;
  num_e_sheets: any;
  num_d_sheets: any;
  check_print: string;
  job_name: string;
  submission_name: string;
  remarks: string;
  main_folder: string;
  files_copied?: string[];
  uploaded_files?: UploadedFile[];
  submitted_by: string;
  created_at?: string;
};

export type MasterSubmissionPage = {
  today: string;
  teams: string[];
  checkers: string[];
  clients: string[];
  projects: string[];
};

export type SubmissionLogPage = {
  submissions: Submission[];
  teams: string[];
  checkers: string[];
  clients: string[];
  page: number;
  total_pages: number;
  total: number;
  per_page: number;
  stats: Record<string, number>;
  q: string;
  team_filter: string;
  checker_filter: string;
  rating_filter: string;
  sort: string;
  order: string;
};
