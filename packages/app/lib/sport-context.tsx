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

const SPORT_KEY = "swingai_selected_sport";
const MOVEMENT_KEY = "swingai_selected_movement";

const TENNIS_SPORT: SelectedSport = {
  id: "tennis",
  name: "Tennis",
  icon: "tennisball-outline",
  color: "#10B981",
};

export function SportProvider({ children }: { children: React.ReactNode }) {
  const [selectedSport, setSelectedSport] = useState<SelectedSport | null>(TENNIS_SPORT);
  const [selectedMovement, setSelectedMovement] = useState<SelectedMovement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSaved();
  }, []);

  const loadSaved = async () => {
    try {
      await AsyncStorage.setItem(SPORT_KEY, JSON.stringify(TENNIS_SPORT));
      await AsyncStorage.removeItem(MOVEMENT_KEY);
      setSelectedSport(TENNIS_SPORT);
      setSelectedMovement(null);
    } catch (e) {
    } finally {
      setIsLoading(false);
    }
  };

  const setSport = useCallback((sport: SelectedSport | null) => {
    const nextSport = sport && sport.name === TENNIS_SPORT.name ? { ...TENNIS_SPORT, ...sport } : TENNIS_SPORT;
    setSelectedSport(nextSport);
    setSelectedMovement(null);
    AsyncStorage.setItem(SPORT_KEY, JSON.stringify(nextSport));
    AsyncStorage.removeItem(MOVEMENT_KEY);
  }, []);

  const setMovement = useCallback((_movement: SelectedMovement | null) => {
    setSelectedMovement(null);
    AsyncStorage.removeItem(MOVEMENT_KEY);
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
