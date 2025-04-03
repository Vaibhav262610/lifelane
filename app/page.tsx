"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer } from "@/components/map-container"
import { ControlPanel } from "@/components/control-panel"
import { EmergencySimulation } from "@/components/emergency-simulation"
import { RoutePreview } from "@/components/route-preview" 
import { useEmergencyRoute } from "@/hooks/use-emergency-route"

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
  // Traffic light management
  const [trafficLights, setTrafficLights] = useState<Array<{
    id: string;
    position: google.maps.LatLngLiteral;
    status: "red" | "yellow" | "green";
    lastChanged: number;
    cycleTime: number;
  }>>([]);
  
  const routePointsRef = useRef<google.maps.LatLngLiteral[]>([]);
  const vehiclePositionRef = useRef<google.maps.LatLngLiteral | null>(null);

  const {
    vehicles,
    directions,
    alerts,
    currentDestination,
    routeInfo,
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
  }>>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [normalEstimatedTime, setNormalEstimatedTime] = useState<number | null>(null);
  const [optimizedEstimatedTime, setOptimizedEstimatedTime] = useState<number | null>(null);
  const [hasReachedDestination, setHasReachedDestination] = useState(false);
  const [showReachedMessage, setShowReachedMessage] = useState(false);

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

  // Generate traffic lights along the route with random initial states
  const generateTrafficLights = (routePoints: google.maps.LatLngLiteral[]) => {
    if (routePoints.length < 4) {
      console.log("Not enough route points to create traffic lights");
      return [];
    }
    
    const lights = [];
    // Place lights at regular intervals, but not at the very start or end
    const interval = Math.max(1, Math.floor(routePoints.length / 5)); // More frequent traffic lights
    
    console.log(`Generating traffic lights with interval ${interval} for ${routePoints.length} points`);
    
    // Possible traffic light states to simulate normal traffic
    const possibleStates = ["red", "yellow", "green"] as const;
    
    for (let i = interval; i < routePoints.length - interval; i += interval) {
      // Add a small offset to position lights slightly to the side of the road
      const offset = 0.0005; // Increased geographical offset for better visibility
      const position = {
        lat: routePoints[i].lat + (Math.random() > 0.5 ? offset : -offset),
        lng: routePoints[i].lng + (Math.random() > 0.5 ? offset : -offset),
      };
      
      // Randomly select an initial state to simulate realistic traffic
      const randomState = possibleStates[Math.floor(Math.random() * possibleStates.length)];
      
      const light = {
        id: `light-${i}`,
        position: position,
        status: randomState,
        lastChanged: Date.now(), // Track when this light last changed state
        cycleTime: 5000 + Math.floor(Math.random() * 5000), // Random cycle time (5-10 seconds)
      };
      
      lights.push(light);
      console.log(`Created traffic light at position:`, position, `with initial state:`, randomState);
    }
    
    console.log(`Generated ${lights.length} traffic lights along the route`);
    return lights;
  };

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
    
    // Generate traffic lights along the route
    const lights = generateTrafficLights(routePointsRef.current);
    setTrafficLights(lights);
    console.log("Generated", lights.length, "traffic lights along the route");
    
    // Force re-render with delay to ensure traffic lights are created
    setTimeout(() => {
      console.log("Forcing traffic light update");
      setTrafficLights([...lights]);
    }, 500);
    
    setAnimationProgress(0);
    
    // Initialize the vehicle position reference
    vehiclePositionRef.current = start;
    
    // Only set the map view once at the beginning to show both start and destination
    if (window.googleMap) {
      // Create a bounds object that includes both start and destination
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(new window.google.maps.LatLng(start.lat, start.lng));
      bounds.extend(new window.google.maps.LatLng(destination.lat, destination.lng));
      
      // Also include all traffic lights
      lights.forEach(light => {
        bounds.extend(new window.google.maps.LatLng(light.position.lat, light.position.lng));
      });
      
      // Fit the map to these bounds with less padding for tighter zoom
      window.googleMap.fitBounds(bounds, 20); // Reduced padding from 100 to 20
      
      // After fitting bounds, zoom in a bit more for better visibility
      setTimeout(() => {
        if (window.googleMap) {
          const currentZoom = window.googleMap.getZoom() || 15;
          // Increase zoom level by 1 to get closer
          window.googleMap.setZoom(currentZoom + 1);
          console.log("Increased zoom level for better traffic light visibility");
        }
      }, 500);
      
      console.log("Set closer map view to show traffic lights more clearly");
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
      
      // Update direction steps based on progress
      if (directionSteps.length > 0) {
        // Calculate which step we're on based on progress
        const stepIndex = Math.min(
          Math.floor(progress * directionSteps.length),
          directionSteps.length - 1
        );
        
        // Only update if the step has changed
        if (stepIndex !== currentStepIndex) {
          setCurrentStepIndex(stepIndex);
          
          // Speak the new instruction
          speakInstruction(directionSteps[stepIndex].instruction);
          
          // Mark previous steps as completed
          setDirectionSteps(prev => 
            prev.map((step, index) => ({
              ...step,
              completed: index < stepIndex
            }))
          );
          
          // Update route info for the control panel
          setRouteInfo(prev => ({
            ...prev,
            steps: directionSteps,
            currentStepIndex: stepIndex
          }));
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
        
        // Update the vehicle position reference for traffic lights
        vehiclePositionRef.current = newPosition;
        
        // Update traffic lights based on new vehicle position
        updateTrafficLights();
      }
      
      // If we're done, show the reached destination message but don't clear interval yet
      if (progress >= 1 && !hasReachedDestination) {
        console.log("Animation complete - destination reached");
        setHasReachedDestination(true);
        
        // Speak destination reached
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
        updateTrafficLights();
        
        // Wait 5 seconds before stopping the simulation completely
        setTimeout(() => {
          clearInterval(interval);
          setAnimationInterval(null);
          console.log("Simulation stopped after 5 seconds delay");
        }, 5000);
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
              
              // Speak the first instruction if available
              if (steps.length > 0) {
                speakInstruction("Starting route guidance. " + steps[0].instruction);
              }
              
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

  // Update traffic light status based on vehicle position and simulate regular traffic changes
  const updateTrafficLights = () => {
    if (!vehiclePositionRef.current) return;
    
    const now = Date.now();
    
    setTrafficLights(prevLights => {
      return prevLights.map(light => {
        // Calculate distance from vehicle to this light
        const distance = calculateDistance(
          vehiclePositionRef.current!,
          light.position
        );
        
        // First determine if this light would normally change based on its cycle time
        const timeSinceLastChange = now - (light.lastChanged || now);
        const shouldChangeCycle = timeSinceLastChange > (light.cycleTime || 8000);
        
        // Determine status based on emergency vehicle distance (priority) or normal cycle
        let newStatus = light.status;
        
        // Emergency vehicle has priority within 500 meters
        if (distance < 0.5) {
          newStatus = "green";
        } else if (distance < 1.0) {
          newStatus = "yellow";
        } else if (shouldChangeCycle) {
          // Normal traffic light cycle if outside emergency vehicle's influence
          // Cycle: red -> green -> yellow -> red
          if (light.status === "red") newStatus = "green";
          else if (light.status === "green") newStatus = "yellow";
          else if (light.status === "yellow") newStatus = "red";
        }
        
        // Only update lastChanged if the state actually changed
        const lastChanged = light.status !== newStatus ? now : (light.lastChanged || now);
        
        return {
          ...light,
          status: newStatus,
          lastChanged: lastChanged,
        };
      });
    });
  };
  
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

  return (
    <main className={`flex min-h-screen flex-col ${isDarkMode ? "bg-gray-900 text-gray-100" : ""}`}>
      <div className={`flex h-16 items-center border-b px-4 ${isDarkMode ? "border-gray-700 bg-gray-900" : ""}`}>
        <h1 className="text-xl font-bold">Emergency Vehicle Traffic Management System</h1>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel
          onStartSimulation={handleStartSimulation}
          onPreviewRoute={handlePreviewRoute}
          onResetSimulation={handleResetSimulation}
          isSimulationRunning={isSimulationRunning}
          currentDestination={currentDestination}
          directions={directions}
          alerts={alerts}
          onAddAmbulance={handleAddAmbulance}
          ambulanceCount={vehicles.length}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          routeInfo={{
            steps: directionSteps,
            currentStepIndex,
            normalEstimatedTime,
            optimizedEstimatedTime,
            hasReachedDestination
          }}
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
                trafficLights={trafficLights}
              />
            )}
            {/* Emergency simulation when running - always render this component */}
            {isSimulationRunning && (
              <EmergencySimulation />
            )}
          </MapContainer>
          
          {/* Add a minimal notification with just progress when simulation is active */}
          {(isSimulationRunning || animationInterval) && (
            <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg">
              <div className="flex items-center space-x-2">
                <span className="animate-pulse">{vehicleType === 'ambulance' ? '🚑' : '🚒'}</span>
                <span>Progress: {Math.round(animationProgress)}% Complete</span>
              </div>
              
              {/* Arrived message */}
              {showReachedMessage && (
                <div className="mt-1 font-bold text-center bg-green-700 py-1 px-2 rounded">
                  Destination Reached!
                </div>
              )}
              
              {/* Progress bar */}
              <div className="mt-1 h-2 w-full rounded-full bg-blue-800">
                <div 
                  className="h-2 rounded-full bg-white transition-all duration-100 ease-out" 
                  style={{ width: `${animationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

