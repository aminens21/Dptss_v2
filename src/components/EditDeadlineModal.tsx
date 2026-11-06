import React from 'react';
import { Sport, Tournament } from '../types';
import { EditTournamentScheduleModal } from './EditTournamentScheduleModal';

interface EditDeadlineModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  tournaments: Tournament[];
  onUpdated: () => void;
}

export const EditDeadlineModal: React.FC<EditDeadlineModalProps> = (props) => {
  return <EditTournamentScheduleModal {...props} />;
};

