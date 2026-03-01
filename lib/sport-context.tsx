import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SelectedSport {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface SelectedMovement {
  id: string;
  name: string;
  icon: string;
}

interface SportContextType {
  selectedSport: SelectedSport | null;
  selectedMovement: SelectedMovement | null;
  isLoading: boolean;
  setSport: (sport: SelectedSport | null) => void;
  setMovement: (movement: SelectedMovement | null) => void;
}

const SportContext = createContext<SportContextType>({
  selectedSport: null,
  selectedMovement: null,
  isLoading: true,
  setSport: () => {},
  setMovement: () => {},
});

const SPORT_KEY = "acexai_selected_sport";
const MOVEMENT_KEY = "acexai_selected_movement";

export function SportProvider({ children }: { children: React.ReactNode }) {
  const [selectedSport, setSelectedSport] = useState<SelectedSport | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<SelectedMovement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    try {
      const sportJson = await AsyncStorage.getItem(SPORT_KEY);
      const movementJson = await AsyncStorage.getItem(MOVEMENT_KEY);
      if (sportJson) setSelectedSport(JSON.parse(sportJson));
      if (movementJson) setSelectedMovement(JSON.parse(movementJson));
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  const setSport = useCallback((sport: SelectedSport | null) => {
    setSelectedSport(sport);
    setSelectedMovement(null);
    if (sport) {
      AsyncStorage.setItem(SPORT_KEY, JSON.stringify(sport));
    } else {
      AsyncStorage.removeItem(SPORT_KEY);
    }
    AsyncStorage.removeItem(MOVEMENT_KEY);
  }, []);

  const setMovement = useCallback((movement: SelectedMovement | null) => {
    setSelectedMovement(movement);
    if (movement) {
      AsyncStorage.setItem(MOVEMENT_KEY, JSON.stringify(movement));
    } else {
      AsyncStorage.removeItem(MOVEMENT_KEY);
    }
  }, []);

  return (
    <SportContext.Provider value={{ selectedSport, selectedMovement, isLoading, setSport, setMovement }}>
      {children}
    </SportContext.Provider>
  );
}

export function useSport() {
  return useContext(SportContext);
}
