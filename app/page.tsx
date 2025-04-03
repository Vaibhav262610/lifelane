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
    // In a more advanced implementation, you could use the actual route points
    if (routePointsRef.current.length < 2) {
      // Create a simple straight-line route with 20 points
      const points: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i <= 20; i++) {
        const fraction = i / 20;
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
      
      // Fit the map to these bounds with some padding
      window.googleMap.fitBounds(bounds, 100); // Increased padding to 100px
      
      console.log("Set initial map view to show entire route with traffic lights");
    }
    
    // Slow down the animation for smoother movement
    const totalDurationMs = 60 * 1000; // 60 seconds (increased from 45)
    const updateIntervalMs = 200; // 200ms (increased from 100ms)
    const totalSteps = totalDurationMs / updateIntervalMs;
    let currentStep = 0;
    let lastPosition = { ...start };
    
    console.log(`Animation will run for ${totalDurationMs/1000} seconds with ${totalSteps} steps`);
    
    const interval = setInterval(() => {
      currentStep++;
      
      // Calculate progress as a fraction from 0 to 1
      const progress = Math.min(currentStep / totalSteps, 1);
      setAnimationProgress(progress * 100);
      
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
        
        // Calculate movement amount to determine if update is needed
        const distanceChange = Math.sqrt(
          Math.pow(newPosition.lat - lastPosition.lat, 2) +
          Math.pow(newPosition.lng - lastPosition.lng, 2)
        );
        
        // Only update position if it changed significantly (reduces jitter)
        if (distanceChange > 0.00005) {
          // Update the starting point marker position
          setStartCoords(newPosition);
          lastPosition = { ...newPosition };
          
          // Update the vehicle position reference for traffic lights
          vehiclePositionRef.current = newPosition;
          
          // Update traffic lights based on new vehicle position
          updateTrafficLights();
        }
        
        // Do NOT update map position during animation - this prevents jittering
        // We already set the map view at the beginning to show the entire route
      }
      
      // If we're done, clear the interval
      if (progress >= 1) {
        console.log("Animation complete");
        clearInterval(interval);
        setAnimationInterval(null);
        
        // Set final position to destination
        setStartCoords(destination);
        vehiclePositionRef.current = destination;
        updateTrafficLights();
      }
    }, updateIntervalMs);
    
    setAnimationInterval(interval);
  };

  // Updated handleStartSimulation to use our new animation
  const handleStartSimulation = (
    startPointInput: string, 
    dest: string, 
    selectedVehicleType: 'ambulance' | 'fire' = 'ambulance'
  ) => {
    console.log("Starting route animation with:", { startPointInput, dest, selectedVehicleType });
    
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
              
              // Start the animation
              animateMarkerAlongRoute(start, destination);
              
              // Update UI state
              setIsSimulationRunning(true);
              setIsRoutePreviewActive(true); // Keep route visible
            } else {
              console.error("Could not get directions, using simple route");
              routePointsRef.current = [];
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

  // Generate traffic lights along the route
  const generateTrafficLights = (routePoints: google.maps.LatLngLiteral[]) => {
    if (routePoints.length < 4) return [];
    
    const lights = [];
    // Place lights at regular intervals, but not at the very start or end
    // Increased number of traffic lights and made them more visible
    const interval = Math.max(1, Math.floor(routePoints.length / 8)); // More traffic lights (8 instead of 5)
    
    for (let i = interval; i < routePoints.length - interval; i += interval) {
      // Add a small offset to position lights slightly to the side of the road
      const offset = 0.0001; // Small geographical offset
      const position = {
        lat: routePoints[i].lat + (Math.random() > 0.5 ? offset : -offset),
        lng: routePoints[i].lng + (Math.random() > 0.5 ? offset : -offset),
      };
      
      lights.push({
        id: `light-${i}`,
        position: position,
        status: "red" as "red" | "yellow" | "green",
      });
    }
    
    console.log("Generated traffic lights:", lights);
    return lights;
  };

  // Update traffic light status based on vehicle position
  const updateTrafficLights = () => {
    if (!vehiclePositionRef.current) return;
    
    setTrafficLights(prevLights => {
      return prevLights.map(light => {
        // Calculate distance from vehicle to this light
        const distance = calculateDistance(
          vehiclePositionRef.current!,
          light.position
        );
        
        // Determine light status based on distance
        // Green when vehicle is close, yellow at medium distance, red otherwise
        let newStatus: "red" | "yellow" | "green" = "red";
        
        if (distance < 0.5) { // Within 500 meters (increased from 200m)
          newStatus = "green";
        } else if (distance < 1.0) { // Within 1km (increased from 500m)
          newStatus = "yellow";
        }
        
        return {
          ...light,
          status: newStatus
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
                trafficLights={trafficLights}
              />
            )}
            {/* Emergency simulation when running - always render this component */}
            {isSimulationRunning && (
              <EmergencySimulation />
            )}
          </MapContainer>
          
          {/* Add a notification with progress when simulation is active */}
          {isSimulationRunning && (
            <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-white shadow-lg">
              <div className="flex items-center space-x-2">
                <span className="animate-pulse">🚗</span>
                <span>Vehicle Moving: {Math.round(animationProgress)}% Complete</span>
              </div>
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

