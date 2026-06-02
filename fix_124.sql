DELETE FROM employee_salary_structure WHERE employee_id = 124 AND amount >= 18000;
UPDATE employee_salary_structure SET is_active = 1, effective_to = NULL WHERE employee_id = 124;
