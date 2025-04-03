"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer } from "@/components/map-container"
import { ControlPanel } from "@/components/control-panel"
import { EmergencySimulation } from "@/components/emergency-simulation"
import { RoutePreview } from "@/components/route-preview" 
import { useEmergencyRoute } from "@/hooks/use-emergency-route"
import { StartPointMarker } from "@/components/start-point-marker"

export default function Home() {
  const [destination, setDestination] = useState("")
  const [startPoint, setStartPoint] = useState("")
  const [isSimulationRunning, setIsSimulationRunning] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isRoutePreviewActive, setIsRoutePreviewActive] = useState(false)
  // State for storing coordinates
  const [startCoords, setStartCoords] = useState<google.maps.LatLngLiteral | undefined>(undefined)
  const [destCoords, setDestCoords] = useState<google.maps.LatLngLiteral | undefined>(undefined)
  const [isManuallyEnteredStart, setIsManuallyEnteredStart] = useState(false)
  const [animationInterval, setAnimationInterval] = useState<NodeJS.Timeout | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [vehicleType, setVehicleType] = useState<'ambulance' | 'fire'>('ambulance');
  // Add routeInfo state
  const [routeInfo, setRouteInfo] = useState<{
    steps: Array<{
      instruction: string;
      distance: string;
      maneuver?: string;
      completed: boolean;
      _forceUpdate?: number;
    }>;
    currentStepIndex: number;
    normalEstimatedTime: number | null;
    optimizedEstimatedTime: number | null;
    hasReachedDestination: boolean;
    _updateTimestamp?: number;
  }>({
    steps: [],
    currentStepIndex: 0,
    normalEstimatedTime: null,
    optimizedEstimatedTime: null,
    hasReachedDestination: false
  });
  
  const routePointsRef = useRef<google.maps.LatLngLiteral[]>([]);
  const vehiclePositionRef = useRef<google.maps.LatLngLiteral | null>(null);

  const {
    vehicles,
    directions,
    alerts,
    currentDestination,
    startSimulation,
    resetSimulation,
    addAmbulance,
  } = useEmergencyRoute()

  // State for directional instructions
  const [directionSteps, setDirectionSteps] = useState<Array<{
    instruction: string;
    distance: string;
    maneuver?: string;
    completed: boolean;
    _forceUpdate?: number;
  }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [normalEstimatedTime, setNormalEstimatedTime] = useState<number | null>(null);
  const [optimizedEstimatedTime, setOptimizedEstimatedTime] = useState<number | null>(null);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [showReachedMessage, setShowReachedMessage] = useState(false);

  // Function to speak navigation instructions using the Web Speech API
  const speakInstruction = (instruction: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      window.speechSynthesis.speak(utterance);
      console.log("Speaking:", instruction);
    } else {
      console.warn("Speech synthesis not supported in this browser");
    }
  };

  // Listen for window.startLocation - but only the initial value, not map clicks
  useEffect(() => {
    if (window.startLocation && !startCoords) {
      setStartCoords(window.startLocation);
    }
  }, [startCoords]);

  // Parse coordinates from string or coordinates
  const parseCoordinates = (coordStr: string): google.maps.LatLngLiteral | null => {
    try {
      if (coordStr.includes(",")) {
        const [lat, lng] = coordStr.split(",").map((coord) => Number.parseFloat(coord.trim()))
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
      return null
    } catch (error) {
      console.error("Failed to parse coordinates:", error)
      return null
    }
  }

  // Preview the route without starting simulation
  const handlePreviewRoute = (
    startPointInput: string, 
    dest: string,
    selectedVehicleType: 'ambulance' | 'fire' = 'ambulance'
  ) => {
    setStartPoint(startPointInput)
    setDestination(dest)
    setVehicleType(selectedVehicleType)
    
    // First try to use the manually entered start point coordinates
    let start = parseCoordinates(startPointInput);
    let isManualStart = false;
    
    // Only fall back to the map marker if the user didn't enter valid coordinates
    if (start) {
      isManualStart = true; // User entered valid coordinates
    } else if (window.startLocation) {
      start = window.startLocation;
      isManualStart = false; // Using map marker
    }
    
    if (start) {
      setStartCoords(start)
      setIsManuallyEnteredStart(isManualStart)
    } else {
      alert("Invalid start location. Please enter valid coordinates or click on the map to set a start point.");
      return;
    }
    
    // Parse destination coordinates
    const destCoordinates = parseCoordinates(dest)
    if (destCoordinates) {
      setDestCoords(destCoordinates)
      setIsRoutePreviewActive(true)
    } else {
      alert("Invalid destination. Please enter valid coordinates.");
    }
  }

  // Function to calculate normal and optimized estimated times
  const calculateEstimatedTimes = (response: google.maps.DirectionsResult) => {
    if (!response.routes || !response.routes[0] || !response.routes[0].legs || !response.routes[0].legs[0]) {
      return { normal: null, optimized: null };
    }
    
    // Get the normal time from Google's directions
    const normalTimeSeconds = response.routes[0].legs[0].duration?.value || 0;
    
    // Calculate optimized time (75% of normal time to simulate our system's efficiency)
    const optimizedTimeSeconds = Math.floor(normalTimeSeconds * 0.75);
    
    return { 
      normal: normalTimeSeconds, 
      optimized: optimizedTimeSeconds 
    };
  };

  // Function to parse and extract directions steps from Google Directions API
  const extractDirectionSteps = (response: google.maps.DirectionsResult) => {
    if (!response.routes || !response.routes[0] || !response.routes[0].legs || !response.routes[0].legs[0]) {
      return [];
    }
    
    const leg = response.routes[0].legs[0];
    return leg.steps.map(step => ({
      instruction: step.instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
      distance: step.distance?.text || '',
      maneuver: step.maneuver || '',
      completed: false
    }));
  };

  // Simple animation function that moves the start point along the route
  const animateMarkerAlongRoute = (
    start: google.maps.LatLngLiteral,
    destination: google.maps.LatLngLiteral
  ) => {
    console.log("Starting marker animation from", start, "to", destination);
    
    // Clear any existing animation
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    // Create a simple route if we don't have one
    if (routePointsRef.current.length < 2) {
      // Create a more detailed straight-line route with 50 points
      const points: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i <= 50; i++) {
        const fraction = i / 50;
        points.push({
          lat: start.lat + (destination.lat - start.lat) * fraction,
          lng: start.lng + (destination.lng - start.lng) * fraction,
        });
      }
      routePointsRef.current = points;
      console.log("Created simple route with", points.length, "points");
    }
    
    setAnimationProgress(0);
    
    // Initialize the vehicle position reference
    vehiclePositionRef.current = start;
    
    // Only set the map view once at the beginning to show both start and destination
    if (window.googleMap) {
      // Create a bounds object that includes both start and destination
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(new window.google.maps.LatLng(start.lat, start.lng));
      bounds.extend(new window.google.maps.LatLng(destination.lat, destination.lng));
      
      // Fit the map to these bounds with less padding for tighter zoom
      window.googleMap.fitBounds(bounds, 20); // Reduced padding from 100 to 20
      
      // After fitting bounds, zoom in a bit more for better visibility
      setTimeout(() => {
        if (window.googleMap) {
          const currentZoom = window.googleMap.getZoom() || 15;
          // Increase zoom level by 1 to get closer
          window.googleMap.setZoom(currentZoom + 1);
        }
      }, 500);
    }
    
    // Calculate random duration between 30-60 seconds for more realistic emergency response
    const minDuration = 30; // 30 seconds minimum
    const maxDuration = 60; // 60 seconds maximum
    const randomDuration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
    const totalDurationMs = randomDuration * 1000;
    
    // Store start time to calculate elapsed time
    const startTime = Date.now();
    
    // Calculate total distance for speed calculation
    const totalDistance = calculateTotalRouteDistance(routePointsRef.current);
    
    // Update animation variables
    const updateIntervalMs = 200; // 200ms
    const totalSteps = totalDurationMs / updateIntervalMs;
    let currentStep = 0;
    let lastPosition = { ...start };
    
    console.log(`Animation will run for ${randomDuration} seconds with ${totalSteps} steps`);
    console.log(`Total route distance: ${totalDistance.toFixed(2)} km`);
    
    // Set vehicle info in state
    setVehicleInfo({
      startTime,
      duration: randomDuration,
      distance: totalDistance,
      speed: totalDistance / (randomDuration / 3600) // km/h
    });
    
    const interval = setInterval(() => {
      currentStep++;
      
      // Calculate progress as a fraction from 0 to 1
      const progress = Math.min(currentStep / totalSteps, 1);
      setAnimationProgress(progress * 100);
      
      // Update elapsed time and remaining time
      const elapsedTime = (Date.now() - startTime) / 1000; // seconds
      const remainingTime = Math.max(0, randomDuration - elapsedTime);
      
      // Update vehicle info with current values - remove speed calculation
      setVehicleInfo(prev => ({
        ...prev,
        elapsedTime,
        remainingTime
      }));
      
      // IMPROVED NAVIGATION STEP LOGIC with more reliable updates - completely redesigned
      if (directionSteps.length > 0 && routePointsRef.current.length > 0) {
        // Calculate progress percentage to determine step
        const completionPercent = progress * 100;
        
        // Use distance-based progress tracking for more accurate step changes
        // Get current vehicle position
        const currentVehiclePosition = vehiclePositionRef.current;
        
        if (currentVehiclePosition) {
          // Calculate which step we should be on based on distance traveled
          let closestStepIndex = 0;
          let cumulativeDistanceTraveled = 0;
          let totalRouteDistance = calculateTotalRouteDistance(routePointsRef.current);
          
          // Progression based on percentage of total route completed
          const distanceTraveled = completionPercent / 100 * totalRouteDistance;
          
          // Map distance traveled to step index with a slightly accelerated progression
          // This ensures steps change slightly before the vehicle actually reaches that point
          const stepProgressionRate = 1.1; // Accelerate step changes by 10%
          const acceleratedDistanceTraveled = distanceTraveled * stepProgressionRate;
          
          // Calculate which step corresponds to this distance
          const stepsPerKm = directionSteps.length / totalRouteDistance;
          const calculatedStepIndex = Math.min(
            Math.floor(acceleratedDistanceTraveled * stepsPerKm),
            directionSteps.length - 1
          );
          
          // Set a minimum step index based on progress to ensure steps advance
          // This guarantees that by 75% progress, we've seen at least 75% of the steps
          const minimumStep = Math.floor(completionPercent / 100 * directionSteps.length * 0.9);
          
          // Take the maximum to ensure we never go backwards in steps
          const newStepIndex = Math.max(calculatedStepIndex, minimumStep);
          
          // Only update if the step changed
          if (newStepIndex !== currentStepIndex) {
            console.log(`Navigation step changing from ${currentStepIndex} to ${newStepIndex} (${completionPercent.toFixed(1)}% complete)`);
            
            // Update the current step index
            setCurrentStepIndex(newStepIndex);
            
            // Create a completely fresh array with updated completion status
            const updatedSteps = directionSteps.map((step, idx) => {
              return {
                ...step,
                instruction: step.instruction,
                distance: step.distance,
                maneuver: step.maneuver,
                completed: idx < newStepIndex,
                // Add a timestamp to force React to see this as a new object
                _forceUpdate: Date.now() + (idx * 100)
              };
            });
            
            // Force replace the steps array
            setDirectionSteps(updatedSteps);
            
            // Update route info with a completely new object
            const updatedRouteInfo = {
              steps: updatedSteps,
              currentStepIndex: newStepIndex,
              normalEstimatedTime: normalEstimatedTime,
              optimizedEstimatedTime: optimizedEstimatedTime,
              hasReachedDestination: progress >= 1,
              _updateTimestamp: Date.now()
            };
            
            setRouteInfo(updatedRouteInfo);
          }
        }
      }
      
      // Log progress every 10%
      if (currentStep % Math.ceil(totalSteps/10) === 0) {
        console.log(`Animation progress: ${Math.round(progress * 100)}%`);
      }
      
      // If we have route points, interpolate between them
      if (routePointsRef.current.length > 1) {
        const routeIndex = Math.min(
          Math.floor(progress * (routePointsRef.current.length - 1)),
          routePointsRef.current.length - 2
        );
        
        const currentPoint = routePointsRef.current[routeIndex];
        const nextPoint = routePointsRef.current[routeIndex + 1];
        const subProgress = (progress * (routePointsRef.current.length - 1)) - routeIndex;
        
        // Interpolate between current and next point
        const newPosition = {
          lat: currentPoint.lat + (nextPoint.lat - currentPoint.lat) * subProgress,
          lng: currentPoint.lng + (nextPoint.lng - currentPoint.lng) * subProgress,
        };
        
        // Always update position for smoother animation
        setStartCoords(newPosition);
        lastPosition = { ...newPosition };
        
        // Update the vehicle position reference
        vehiclePositionRef.current = newPosition;
      }
      
      // If we're done, show the reached destination message but don't clear interval yet
      if (progress >= 1 && !hasReachedDestination) {
        console.log("Animation complete - destination reached");
        setHasReachedDestination(true);
        
        // Speak destination reached without delay
        speakInstruction("You have reached your destination.");
        
        // Show the reached message
        setShowReachedMessage(true);
        
        // Update route info for the control panel
        setRouteInfo(prev => ({
          ...prev,
          hasReachedDestination: true
        }));
        
        // Mark all direction steps as completed
        setDirectionSteps(prev => 
          prev.map(step => ({
            ...step,
            completed: true
          }))
        );
        
        // Set final position to destination
        setStartCoords(destination);
        vehiclePositionRef.current = destination;
        
        // Stop the simulation - remove the 5 second delay
        clearInterval(interval);
        setAnimationInterval(null);
        console.log("Simulation stopped immediately after reaching destination");
        // Properly stop simulation
        setIsSimulationRunning(false);
      }
    }, updateIntervalMs);
    
    setAnimationInterval(interval);
  };

  // Calculate total distance of route in kilometers
  const calculateTotalRouteDistance = (points: google.maps.LatLngLiteral[]): number => {
    if (points.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      totalDistance += calculateDistance(points[i], points[i + 1]);
    }
    
    return totalDistance;
  };

  // Add state for vehicle information
  const [vehicleInfo, setVehicleInfo] = useState<{
    startTime?: number;
    duration?: number;
    distance?: number;
    speed?: number;
    elapsedTime?: number;
    remainingTime?: number;
    currentSpeed?: number;
  }>({});

  // Updated handleStartSimulation to extract direction steps
  const handleStartSimulation = (
    startPointInput: string, 
    dest: string, 
    selectedVehicleType: 'ambulance' | 'fire' = 'ambulance'
  ) => {
    console.log("Starting route animation with:", { startPointInput, dest, selectedVehicleType });
    
    // Reset states
    setHasReachedDestination(false);
    setShowReachedMessage(false);
    
    // Update vehicle type
    setVehicleType(selectedVehicleType);
    
    // First preview the route to set up coordinates
    handlePreviewRoute(startPointInput, dest, selectedVehicleType);
    
    // Parse coordinates directly
    const start = parseCoordinates(startPointInput) || window.startLocation;
    const destination = parseCoordinates(dest);
    
    // Only proceed if we have valid coordinates
    if (start && destination) {
      console.log("Starting animation with coordinates:", { start, destination });
      
      // Store route points from Google Directions API
      // This would be populated by the RoutePreview component
      if (window.googleMap && window.google) {
        const directionsService = new window.google.maps.DirectionsService();
        
        directionsService.route(
          {
            origin: start,
            destination: destination,
            travelMode: window.google.maps.TravelMode.DRIVING,
          },
          (response, status) => {
            if (status === window.google.maps.DirectionsStatus.OK && response) {
              // Extract route points
              const points: google.maps.LatLngLiteral[] = [];
              const route = response.routes[0];
              const path = route.overview_path;
              
              // Convert Google's LatLng objects to LatLngLiteral
              path.forEach(point => {
                points.push({
                  lat: point.lat(),
                  lng: point.lng(),
                });
              });
              
              routePointsRef.current = points;
              console.log("Got actual route with", points.length, "points");
              
              // Extract direction steps
              const steps = extractDirectionSteps(response);
              setDirectionSteps(steps);
              setCurrentStepIndex(0);
              console.log("Extracted direction steps:", steps);
              
              // Calculate and set estimated times
              const times = calculateEstimatedTimes(response);
              setNormalEstimatedTime(times.normal);
              setOptimizedEstimatedTime(times.optimized);
              
              // Speak ONLY the starting announcement, not the first instruction
              speakInstruction("Starting emergency route guidance.");
              
              // Start the animation
              animateMarkerAlongRoute(start, destination);
              
              // Update UI state
              setIsSimulationRunning(true);
              setIsRoutePreviewActive(true); // Keep route visible
              
              // Set route info for the control panel
              setRouteInfo({
                steps: steps,
                currentStepIndex: 0,
                normalEstimatedTime: times.normal,
                optimizedEstimatedTime: times.optimized,
                hasReachedDestination: false
              });
            } else {
              console.error("Could not get directions, using simple route");
              routePointsRef.current = [];
              setDirectionSteps([]);
              setNormalEstimatedTime(null);
              setOptimizedEstimatedTime(null);
              animateMarkerAlongRoute(start, destination);
              
              setIsSimulationRunning(true);
              setIsRoutePreviewActive(true);
            }
          }
        );
      } else {
        // Fallback for when Google Maps is not available
        console.log("Google Maps not available, using simple route");
        routePointsRef.current = [];
        setDirectionSteps([]);
        setNormalEstimatedTime(null);
        setOptimizedEstimatedTime(null);
        animateMarkerAlongRoute(start, destination);
        
        setIsSimulationRunning(true);
        setIsRoutePreviewActive(true);
      }
    } else {
      console.error("Could not start animation: invalid coordinates", { start, destination });
      alert("Please enter valid coordinates for both start and destination points.");
    }
  }
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationInterval) {
        clearInterval(animationInterval);
      }
    };
  }, [animationInterval]);

  // Updated handleResetSimulation to clear animation
  const handleResetSimulation = () => {
    // Clear any running animation
    if (animationInterval) {
      clearInterval(animationInterval);
      setAnimationInterval(null);
    }
    
    resetSimulation();
    setIsSimulationRunning(false);
    setDestination("");
    setIsRoutePreviewActive(false);
    setAnimationProgress(0);
    // Keep the start coordinates but clear destination
    setDestCoords(undefined);
  }

  const handleAddAmbulance = () => {
    addAmbulance()
  }

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  // Helper function to calculate distance between two points in kilometers
  const calculateDistance = (
    point1: google.maps.LatLngLiteral,
    point2: google.maps.LatLngLiteral
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Add a diagnostics effect to log updates to help debug
  useEffect(() => {
    if (routeInfo && routeInfo.steps && routeInfo.steps.length > 0) {
      console.log(`routeInfo was updated with ${routeInfo.steps.length} steps, current step: ${routeInfo.currentStepIndex}`);
    }
  }, [routeInfo]);

  // Call this function when the map is initialized - use fixed positions for ALL controls
  useEffect(() => {
    // Small delay to ensure map is loaded
    setTimeout(() => {
      if (window.googleMap) {
        // Set ALL map controls to fixed positions
        window.googleMap.setOptions({
          zoomControl: true,
          zoomControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM
          },
          scrollwheel: true,
          draggable: true,
          disableDoubleClickZoom: false,
          mapTypeControl: true,
          mapTypeControlOptions: {
            position: window.google.maps.ControlPosition.LEFT_BOTTOM,
            style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR
          },
          streetViewControl: true,
          streetViewControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_BOTTOM
          },
          fullscreenControl: true,
          fullscreenControlOptions: {
            position: window.google.maps.ControlPosition.RIGHT_TOP
          }
        });
        
        console.log("Map controls configured with fixed positions");
      }
    }, 1000);
  }, []);

  // Implement a COMPLETELY NEW navigation instructions update mechanism
  useEffect(() => {
    // Aggressive update mechanism: Force updates very frequently
    if (isSimulationRunning) {
      console.log("Setting up aggressive navigation update interval");
      
      // Create a high-frequency update interval
      const aggressiveUpdateInterval = setInterval(() => {
        if (routeInfo && routeInfo.steps && routeInfo.steps.length > 0) {
          // Calculate current progress
          const progressPercent = animationProgress;
          
          // Determine step based on progress
          const newStepIndex = Math.min(
            Math.floor((progressPercent / 100) * routeInfo.steps.length),
            routeInfo.steps.length - 1
          );
          
          console.log(`Forcing navigation update: Progress ${progressPercent.toFixed(1)}%, Step ${newStepIndex+1}/${routeInfo.steps.length}`);
          
          // Create entirely new step objects to ensure React detects changes
          const forceUpdatedSteps = routeInfo.steps.map((step, idx) => ({
            ...step,
            instruction: step.instruction,
            distance: step.distance,
            maneuver: step.maneuver,
            completed: idx < newStepIndex,
            _forceUpdate: Date.now() + idx // Unique timestamp for each step
          }));
          
          // Force update both state variables
          setCurrentStepIndex(newStepIndex);
          setDirectionSteps(forceUpdatedSteps);
          
          // Create a completely new routeInfo object
          setRouteInfo({
            steps: forceUpdatedSteps,
            currentStepIndex: newStepIndex,
            normalEstimatedTime,
            optimizedEstimatedTime,
            hasReachedDestination: progressPercent >= 100,
            _updateTimestamp: Date.now()
          });
        }
      }, 200); // Ultra-fast updates - 5 times per second
      
      return () => clearInterval(aggressiveUpdateInterval);
    }
  }, [isSimulationRunning, animationProgress, routeInfo?.steps?.length]);
  
  // In the render method, convert string[] alerts to {title, message}[] alerts
  // Fix for the alerts type error
  const formattedAlerts = alerts.map(alert => ({ 
    title: "System Alert", 
    message: alert 
  }));

  return (
    <main className={`flex min-h-screen flex-col ${isDarkMode ? "bg-gray-900 text-gray-100" : ""}`}>
      <div className={`flex h-16 items-center border-b px-4 ${isDarkMode ? "border-gray-700 bg-gray-900" : ""}`}>
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-green-500 text-transparent bg-clip-text">LifeLane</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          onStartSimulation={handleStartSimulation}
          onPreviewRoute={handlePreviewRoute}
          onResetSimulation={handleResetSimulation}
          isSimulationRunning={isSimulationRunning}
          currentDestination={currentDestination}
          directions={directions}
          alerts={formattedAlerts}
          onAddAmbulance={handleAddAmbulance}
          ambulanceCount={vehicles.length}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          routeInfo={routeInfo}
        />
        <div className="relative flex-1">
          <MapContainer isDarkMode={isDarkMode}>
            {/* Always show RoutePreview when we have coordinates */}
            {startCoords && destCoords && (
              <RoutePreview 
                startPoint={startCoords} 
                destination={destCoords} 
                isSimulationActive={isSimulationRunning || animationInterval !== null}
                isManuallyEnteredStart={isManuallyEnteredStart}
                vehicleType={vehicleType}
              />
            )}
            {/* Emergency simulation when running - always render this component */}
            {isSimulationRunning && (
              <EmergencySimulation />
            )}
          </MapContainer>

          {/* Top-right corner navigation instructions - Only show when vehicle has NOT reached destination */}
          {(isSimulationRunning || animationInterval) && 
           routeInfo && routeInfo.steps && routeInfo.steps.length > 0 && 
           !hasReachedDestination && !showReachedMessage && (
            <div 
              key={`nav-container-${Date.now()}`}
              className={`absolute top-16 right-4 z-10 w-80 max-h-96 overflow-y-auto rounded-md shadow-lg ${isDarkMode ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}
            >
              <div className={`p-3 font-medium border-b ${isDarkMode ? "border-gray-700 text-white" : "border-gray-200"}`}>
                Navigation Instructions
              </div>
              <div className="p-2 space-y-2 max-h-80 overflow-y-auto">
                {routeInfo.steps.map((step, index) => (
                  <div 
                    key={`nav-step-${index}-${Date.now()}`} 
                    className={`p-2 rounded-md ${
                      index === routeInfo.currentStepIndex
                        ? isDarkMode 
                          ? "bg-blue-900 text-white" 
                          : "bg-blue-50 border-blue-200"
                        : isDarkMode
                          ? "bg-gray-700 text-gray-300"
                          : "bg-gray-50"
                    } ${step.completed ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                        index === routeInfo.currentStepIndex
                          ? isDarkMode
                            ? "bg-blue-500 text-white"
                            : "bg-blue-500 text-white"
                          : step.completed
                            ? isDarkMode
                              ? "bg-gray-600 text-gray-300"
                              : "bg-gray-400 text-white"
                            : isDarkMode
                              ? "bg-gray-600 text-gray-300" 
                              : "bg-gray-300 text-gray-700"
                      }`}>
                        {step.completed ? "✓" : index + 1}
                      </div>
                      <div className="flex-1 text-sm">
                        <span className={`${step.completed ? "line-through" : ""}`}>{step.instruction}</span>
                        {step.distance && (
                          <span className={`text-xs block ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                            {step.distance}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Progress Bar */}
          {(isSimulationRunning || animationInterval) && (
            <div className={`absolute left-0 right-0 top-0 p-3 ${isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white/80 shadow-md"} transition-all duration-300`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <span className={`font-medium ${isDarkMode ? "text-blue-300" : "text-blue-600"}`}>
                    Emergency Route
                  </span>
                  {vehicleType && (
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      vehicleType === 'ambulance' 
                        ? isDarkMode ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800' 
                        : isDarkMode ? 'bg-orange-900 text-orange-100' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {vehicleType === 'ambulance' ? 'Ambulance' : 'Fire Truck'}
                    </span>
                  )}
                </div>
                <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                  {animationProgress.toFixed(0)}% Complete
                </div>
              </div>

              {/* Progress bar */}
              <div className={`h-2 w-full overflow-hidden rounded-full ${isDarkMode ? "bg-gray-700" : "bg-gray-200"}`}>
                <div
                  className={`h-full rounded-full transition-all ${
                    hasReachedDestination 
                      ? isDarkMode ? "bg-green-500" : "bg-green-500" 
                      : isDarkMode ? "bg-blue-500" : "bg-blue-600"
                  }`}
                  style={{ width: `${animationProgress}%` }}
                />
              </div>

              {/* Destination reached message */}
              {showReachedMessage && (
                <div className={`mt-2 text-center font-bold ${isDarkMode ? "text-green-400" : "text-green-600"}`}>
                  Destination Reached!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

