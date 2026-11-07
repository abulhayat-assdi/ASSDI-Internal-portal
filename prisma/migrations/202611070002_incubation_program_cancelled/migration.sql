-- Adds the 'cancelled' program status. Existing rows keep their status.
ALTER TABLE incubation_programs DROP CONSTRAINT incubation_program_status;
ALTER TABLE incubation_programs ADD CONSTRAINT incubation_program_status CHECK (status IN ('draft','active','closing','closed','archived','cancelled'));
